import { execFile } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import activation from '../hooks/simple-english-activate.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const HOOK = path.join(ROOT, 'src', 'hooks', 'lint_hook.py');

export default function simpleEnglish(pi) {
  let context = activation.FALLBACK_CONTEXT;
  let warned = false;

  function warn(ctx) {
    if (!warned && ctx.hasUI) {
      warned = true;
      ctx.ui.notify('Simple English lint unavailable. Check that Python 3.9+ is installed as python3.', 'warning');
    }
  }

  // Reuse the hook protocol so exclusions, hit limits, and reply rules stay in Python.
  async function lint(event, ctx) {
    const result = await new Promise((resolve) => {
      const child = execFile('python3', [HOOK], {
        cwd: ctx.cwd,
        timeout: 10000,
        maxBuffer: 64 * 1024,
        signal: ctx.signal,
      }, (error, stdout, stderr) => resolve({ code: error ? error.code : 0, stdout, stderr }));
      // A missing interpreter or an abort can close stdin before the write completes.
      child.stdin.on('error', () => {});
      child.stdin.end(JSON.stringify(event));
    });
    if (result.code !== 0 && result.code !== 2) {
      if (!ctx.signal?.aborted) warn(ctx);
      return undefined;
    }
    return result;
  }

  pi.on('session_start', () => {
    warned = false;
    context = activation.buildContext(activation.readFirstFile([
      path.join(ROOT, 'prompts', 'system-prompt.md'),
    ]));
  });

  // A system section is reapplied on each run, including after compaction/resume.
  // It avoids adding duplicate activation messages to the conversation history.
  pi.on('before_agent_start', (event) => {
    event.systemPromptOptions.sections.simple_english = context;
  });

  pi.on('tool_result', async (event, ctx) => {
    if (event.isError || !['write', 'edit'].includes(event.toolName)) return;
    const target = event.input.path;
    if (typeof target !== 'string' || !target.endsWith('.md')) return;
    const result = await lint({
      hook_event_name: 'PostToolUse',
      cwd: ctx.cwd,
      tool_input: { file_path: target.replace(/^@/, '') },
    }, ctx);
    if (result?.code === 2 && result.stderr.trim()) {
      return { content: [...event.content, { type: 'text', text: result.stderr.trim() }] };
    }
  });

  // Unlike agent_end, this runs after automatic retries and queued follow-ups.
  // Persist advice for the next turn without requesting a corrective model call.
  pi.on('agent_before_settle', async (event, ctx) => {
    if (event.outcome !== 'completed') return;
    const last = event.context.contextMessages.findLast((message) => message.role === 'assistant');
    if (!last || last.content.some((part) => part.type === 'toolCall')) return;
    const reply = last.content.filter((part) => part.type === 'text').map((part) => part.text).join('\n');
    if (!reply.trim()) return;
    const result = await lint({ hook_event_name: 'Stop', last_assistant_message: reply }, ctx);
    if (!result || result.code !== 0 || !result.stdout.trim()) return;
    try {
      const { systemMessage } = JSON.parse(result.stdout);
      if (typeof systemMessage !== 'string' || !systemMessage) return;
      return {
        entries: [...event.entries, {
          type: 'custom_message',
          customType: 'simple-english-reply-check',
          content: systemMessage,
          display: true,
        }],
      };
    } catch {
      warn(ctx);
    }
  });
}
