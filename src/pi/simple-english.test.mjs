import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import simpleEnglish from './simple-english.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SLOP = 'You should simply leverage the robust tool, making it seamless.\n';

function harness(t, factory = simpleEnglish) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'simple-english-pi-'));
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  const handlers = new Map();
  const notices = [];
  factory({ on: (event, handler) => handlers.set(event, handler) });
  const ctx = { cwd, hasUI: true, ui: { notify: (...args) => notices.push(args) } };
  return { cwd, notices, emit: (name, event = {}) => handlers.get(name)(event, ctx) };
}

function toolEvent(toolName = 'write', target = 'notes.md', extra = {}) {
  return {
    toolName,
    input: { path: target },
    content: [{ type: 'text', text: 'File saved.' }],
    isError: false,
    ...extra,
  };
}

function settleEvent(text, extra = {}) {
  return {
    outcome: 'completed',
    entries: [{ type: 'custom', customType: 'another-extension', data: 1 }],
    continue: false,
    context: { contextMessages: [{ role: 'assistant', content: [{ type: 'text', text }] }] },
    ...extra,
  };
}

test('session activation matches the Claude hook and stays present on later runs', async (t) => {
  const h = harness(t);
  const cli = spawnSync(process.execPath, [path.join(ROOT, 'src/hooks/simple-english-activate.js')], {
    encoding: 'utf8',
    env: { ...process.env, PLUGIN_ROOT: ROOT, CLAUDE_PLUGIN_ROOT: '' },
  });
  assert.equal(cli.status, 0, cli.stderr);
  await h.emit('session_start', { reason: 'startup' });
  for (let i = 0; i < 2; i++) {
    const event = { systemPromptOptions: { sections: { existing: 'Keep this.' } } };
    assert.equal(await h.emit('before_agent_start', event), undefined);
    assert.equal(event.systemPromptOptions.sections.simple_english, cli.stdout);
    assert.equal(event.systemPromptOptions.sections.existing, 'Keep this.');
  }
});

test('activation uses the shared fallback for missing and oversized prompts', async (t) => {
  const h = harness(t);
  const root = path.join(h.cwd, 'package');
  fs.mkdirSync(path.join(root, 'src/pi'), { recursive: true });
  fs.mkdirSync(path.join(root, 'src/hooks'), { recursive: true });
  fs.mkdirSync(path.join(root, 'prompts'));
  fs.copyFileSync(path.join(ROOT, 'src/pi/simple-english.mjs'), path.join(root, 'src/pi/simple-english.mjs'));
  fs.copyFileSync(path.join(ROOT, 'src/hooks/simple-english-activate.js'), path.join(root, 'src/hooks/simple-english-activate.js'));
  const { default: factory } = await import(pathToFileURL(path.join(root, 'src/pi/simple-english.mjs')).href);
  const isolated = harness(t, factory);
  for (const oversized of [false, true]) {
    if (oversized) fs.writeFileSync(path.join(root, 'prompts/system-prompt.md'), 'x'.repeat(10000));
    await isolated.emit('session_start', { reason: 'reload' });
    const event = { systemPromptOptions: { sections: {} } };
    await isolated.emit('before_agent_start', event);
    const text = event.systemPromptOptions.sections.simple_english;
    assert.ok(text.startsWith('SIMPLE ENGLISH SKILL ACTIVE AUTOMATICALLY'));
    assert.ok(text.includes('Do not change code, identifiers, commands, or quoted errors.'));
    assert.ok(!text.includes('THE REPLY'));
    assert.ok(text.length < 9500);
  }
});

test('write and edit results get advisory findings without replacing successful output', async (t) => {
  const h = harness(t);
  fs.writeFileSync(path.join(h.cwd, 'notes.md'), SLOP);
  for (const name of ['write', 'edit']) {
    const event = toolEvent(name, '@notes.md');
    const patch = await h.emit('tool_result', event);
    assert.deepEqual(patch.content[0], event.content[0]);
    assert.match(patch.content[1].text, /notes\.md has \d+ STE violations/);
    assert.match(patch.content[1].text, /line 1, banned_modal: should/);
    assert.equal(Object.hasOwn(patch, 'isError'), false);
    assert.equal(fs.readFileSync(path.join(h.cwd, 'notes.md'), 'utf8'), SLOP);
  }
});

test('non-Markdown, failed tools, unrelated tools, and clean Markdown stay unchanged', async (t) => {
  const h = harness(t);
  fs.writeFileSync(path.join(h.cwd, 'clean.md'), 'Run the migration. Then restart the service.\n');
  for (const event of [
    toolEvent('write', 'notes.py'),
    toolEvent('read'),
    toolEvent('write', 'notes.md', { isError: true }),
    toolEvent('write', 'clean.md'),
    toolEvent('write', 'missing.md'),
  ]) {
    assert.equal(await h.emit('tool_result', event), undefined);
  }
});

test('Python exclusions, config directories, and the wildcard opt-out apply through the adapter', async (t) => {
  const h = harness(t);
  fs.writeFileSync(path.join(h.cwd, 'notes.md'), SLOP);
  const config = path.join(h.cwd, 'claude-config');
  fs.mkdirSync(config);
  fs.writeFileSync(path.join(config, 'memory.md'), SLOP);
  fs.mkdirSync(path.join(h.cwd, '.claude'));
  fs.writeFileSync(path.join(h.cwd, '.claude/memory.md'), SLOP);
  const previous = { exclude: process.env.SIMPLE_ENGLISH_LINT_EXCLUDE, config: process.env.CLAUDE_CONFIG_DIR };
  t.after(() => {
    for (const [key, value] of [['SIMPLE_ENGLISH_LINT_EXCLUDE', previous.exclude], ['CLAUDE_CONFIG_DIR', previous.config]]) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  });
  process.env.CLAUDE_CONFIG_DIR = config;
  process.env.SIMPLE_ENGLISH_LINT_EXCLUDE = '';
  assert.ok(await h.emit('tool_result', toolEvent()));
  assert.equal(await h.emit('tool_result', toolEvent('write', 'claude-config/memory.md')), undefined);
  assert.equal(await h.emit('tool_result', toolEvent('write', '.claude/memory.md')), undefined);
  process.env.SIMPLE_ENGLISH_LINT_EXCLUDE = '*';
  assert.equal(await h.emit('tool_result', toolEvent()), undefined);
  // The Markdown opt-out must not disable the independent reply check.
  const advice = await h.emit('agent_before_settle', settleEvent('**Yes** — it is robust.'));
  assert.match(advice.entries.at(-1).content, /reply check/);
});

test('settlement checks the final reply, preserves boundary entries, and never requests continuation', async (t) => {
  const h = harness(t);
  const event = settleEvent('**Yes** — it is robust.');
  event.context.contextMessages.unshift({ role: 'assistant', content: [{ type: 'text', text: 'Earlier reply.' }] });
  const patch = await h.emit('agent_before_settle', event);
  assert.deepEqual(patch.entries[0], event.entries[0]);
  assert.match(patch.entries[1].content, /1 em-dash\(s\).*1 bold span\(s\)/);
  assert.equal(Object.hasOwn(patch, 'continue'), false);
  for (const boundary of [
    settleEvent('The build failed because the disk was full.'),
    settleEvent('**Aborted**', { outcome: 'aborted' }),
    settleEvent('**Failed**', { outcome: 'error' }),
    settleEvent('', { context: { contextMessages: [] } }),
    settleEvent('', { context: { contextMessages: [{ role: 'assistant', content: [{ type: 'toolCall', name: 'write' }] }] } }),
  ]) {
    assert.equal(await h.emit('agent_before_settle', boundary), undefined);
  }
});

test('missing Python remains advisory and warns only once per session', async (t) => {
  const h = harness(t);
  fs.writeFileSync(path.join(h.cwd, 'notes.md'), SLOP);
  const previous = process.env.PATH;
  process.env.PATH = h.cwd;
  t.after(() => { if (previous === undefined) delete process.env.PATH; else process.env.PATH = previous; });
  assert.equal(await h.emit('tool_result', toolEvent()), undefined);
  assert.equal(await h.emit('agent_before_settle', settleEvent('**Yes**')), undefined);
  assert.equal(h.notices.length, 1);
  assert.match(h.notices[0][0], /Python 3\.9\+/);
});
