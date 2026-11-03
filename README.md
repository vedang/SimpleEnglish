<p align="center">
  <strong>✈️ your AI writes like a LinkedIn post. make it write like a Boeing manual.</strong>
</p>

<p align="center">
  An agent skill that makes LLMs write plain English with the discipline of <a href="https://www.asd-ste100.org/">ASD-STE100 Simplified Technical English</a>,<br>
  the controlled language aerospace has used since 1983 so that a tired mechanic cannot misread an instruction.<br>
  Layman-readable by default, STE-strict on request.
</p>

<p align="center">
  <a href="evals/results/rebuild-2026-09-02/RESULTS.md"><img src="https://img.shields.io/badge/reply_defects-%E2%88%9295%25_measured-brightgreen?style=flat" alt="95% fewer visible reply defects, measured"></a>
  <a href="evals/results/RESULTS.md"><img src="https://img.shields.io/badge/benchmarked_on-9_Claude_models-blueviolet?style=flat" alt="9 models benchmarked"></a>
  <a href="https://agentskills.io"><img src="https://img.shields.io/badge/SKILL.md-open_standard-blue?style=flat" alt="Agent Skills"></a>
  <a href="skills/simple-english/SKILL.md"><img src="https://img.shields.io/badge/version-2.1.1-blue?style=flat" alt="version 2.1.1"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-lightgrey?style=flat" alt="MIT"></a>
  <a href="https://github.com/AminBlg/SimpleEnglish/stargazers"><img src="https://img.shields.io/github/stars/AminBlg/SimpleEnglish?style=flat&logo=github&color=yellow" alt="GitHub stars"></a>
</p>

<p align="center">
  <a href="https://trendshift.io/repositories/97933?utm_source=trendshift-badge&amp;utm_medium=badge&amp;utm_campaign=badge-trendshift-97933" target="_blank" rel="noopener noreferrer"><img src="https://trendshift.io/api/badge/trendshift/repositories/97933/daily" alt="AminBlg%2FSimpleEnglish | Trendshift" width="250" height="55"/></a>
</p>

Works in every agent that reads the [Agent Skills standard](https://agentskills.io): Claude Code, Cursor, VS Code Copilot, OpenAI Codex, Gemini CLI, Goose, OpenCode, and about 25 more. One folder, no dependencies, MIT.

## Install

The Claude Code and Pi instructions below install from [Vedang's fork](https://github.com/vedang/SimpleEnglish).

The original project is [AminBlg/SimpleEnglish](https://github.com/AminBlg/SimpleEnglish).

For a skill-only install in any supported agent, use the [skills CLI](https://github.com/vercel-labs/skills):

```bash
npx skills add vedang/SimpleEnglish
```

This installs only the skill, not the Claude Code hooks and output style or the Pi extension. Use the Claude Code or Pi instructions below for automatic activation and advisory writing checks.

### Pi coding agent

Install the Pi package from the fork to get the skill and automatic writing checks:

```bash
pi install git:github.com/vedang/SimpleEnglish
```

By default, Pi records the package in `~/.pi/agent/settings.json` for all projects. Add `--local` for the current project instead. That records the package in `.pi/settings.json`. Pi loads project packages only after you trust the project.

To keep a reviewed revision, append `@<commit>` to the git source. That commit must contain the root `package.json` with the skill and extension entries.

Alternatively, install from a local checkout:

```bash
pi install /absolute/path/to/SimpleEnglish
```

Pi loads the local directory in place. Keep the checkout at that path.

Start Pi, or run `/reload` in an open session. Invoke the skill explicitly:

```text
/skill:simple-english Rewrite this README in plain English.
```

The package also includes a Pi extension that activates the writing rules automatically. It uses the same prompt and advisory checks as the Claude Code hooks, with no copied rule set. The skill command loads the full instructions and references when you need them. The Claude Code output style and the standalone prompt are not registered as Pi resources.

The extension uses these Pi events:

- `session_start` reads the shared activation prompt. `before_agent_start` adds it as a system-prompt section on every run, including after resume or compaction. The existing 9,500-character cap and fallback rule set apply.
- `tool_result` checks successful `write` and `edit` calls on `.md` files. Findings are appended to the tool result for the model; the tool stays successful and the extension does not edit the file.
- `agent_before_settle` is the Stop equivalent. It checks the final reply after retries and queued work. Advice is saved as a visible model-context message, without requesting another model turn. Aborted and failed runs are skipped.

Node.js is provided by Pi. The advisory checks also need Python 3.9 or newer as `python3` on your PATH. Each Python check has a 10-second timeout and a 64 KiB limit per output stream. If Python is missing or the process fails, the extension leaves the result unchanged and warns once per session when a UI is available. Activation still works. No npm dependencies or install scripts are added; the extension runs local code and starts Python only for a writing check, never a benchmark or a model client.

The Markdown checks honor `CLAUDE_CONFIG_DIR` and `SIMPLE_ENGLISH_LINT_EXCLUDE`, including the existing `.claude` exclusions. Set `SIMPLE_ENGLISH_LINT_EXCLUDE='*'` before starting Pi to skip all Markdown checks; the reply check still runs. See [the hook exclusions](src/hooks/README.md#what-the-file-check-skips) for glob syntax. Findings can include document excerpts in model context, so exclude confidential paths.

For skill-only use without automatic activation or checks, disable this package's extension in `pi config`, or filter it in `~/.pi/agent/settings.json`:

```json
{
  "packages": [
    { "source": "git:github.com/vedang/SimpleEnglish", "extensions": [] }
  ]
}
```

Edit the existing package entry rather than adding a duplicate. Use the same source you installed, including any commit suffix or local path. For a project install, edit `.pi/settings.json` instead. Run `/reload` after changing the resource selection.

To run the offline Pi adapter tests without a model call:

```bash
node --test src/pi/simple-english.test.mjs
```

### Claude Code

If you already registered the upstream marketplace, inspect its source in Claude Code's `/plugin` marketplace view before installing. Both repositories use the same marketplace name. To use this fork, replace the upstream registration with the fork first. Do not assume that another `marketplace add` switches it.

Run these commands in your terminal to install from the fork for your user account:

```bash
claude plugin marketplace add vedang/SimpleEnglish --scope user
claude plugin install simple-english@simple-english --scope user
```

Both `.claude-plugin/marketplace.json` and `.claude-plugin/plugin.json` use the name `simple-english`. The marketplace's plugin source is `./`, so it loads the plugin from the fork checkout. The upstream homepage and author fields do not select the install source.

The explicit `--scope user` setting makes the installation available across projects. For a shared project installation, use `--scope project` on both commands. Use `--scope local` on both for a private installation in the current project. Project scope uses `.claude/settings.json`. Local scope uses `.claude/settings.local.json`.

Restart Claude Code after installation so a new session loads the plugin and its `SessionStart` hook. The plugin supplies the skill, the output style, and three hooks:

- `SessionStart` loads the condensed writing rules automatically.
- `PostToolUse` checks Markdown files after `Write` and `Edit` calls.
- `Stop` checks the last reply. Both writing checks are advisory. They do not block the session.

The hooks need `node` and Python 3.9 or newer as `python3` on your PATH. See [the hook details](src/hooks/README.md#what-the-hook-sends) and [file exclusions](src/hooks/README.md#what-the-file-check-skips).

The output style is named `simple-english:simple-english`. The short name does not resolve. Select it with `/config` under Output style, or put `{"outputStyle": "simple-english:simple-english"}` in `~/.claude/settings.json`. A skill-only install does not provide this output style.

### Codex plugin (upstream)

Codex plugin, with the session hook:

```bash
codex plugin marketplace add AminBlg/SimpleEnglish
codex plugin add simple-english@simple-english
```

Codex asks you to trust the hook before its first run. The hooks need Node.js. Details in [`src/hooks/README.md`](src/hooks/README.md).

No skill support? Paste the rule block of [`prompts/system-prompt.md`](prompts/system-prompt.md) into your system prompt, `AGENTS.md`, or `.cursorrules`. The page ends with a 60-token version for tight budgets.

Then ask for any technical writing, or say "rewrite this with simple-english".

## See it

Left is real, unedited Claude output. Right is the same model with the skill loaded.

<table>
<tr>
<th width="50%">Without skill</th>
<th width="50%">With skill</th>
</tr>
<tr>
<td valign="top">

> Leveraging sqlpipe's robust architecture, users can seamlessly synchronize their Postgres tables to S3 with minimal configuration overhead. Before getting started, you should ensure that your AWS credentials have been properly configured — this is crucial for avoiding frustrating permission issues down the line.

</td>
<td valign="top">

> sqlpipe copies your Postgres tables to S3. It needs one configuration file.
>
> Before you start, make sure that your AWS credentials are correct. If they are not, S3 rejects the upload with a permission error.

</td>
</tr>
</table>

More rewrites in [`examples/before-after.md`](examples/before-after.md): READMEs, runbooks, incident reports, error messages, release notes.

## Benchmarks

Every number below is recomputed from the committed raw files by `python3 evals/check_numbers.py`, which CI runs on every push. All Claude runs: `claude-sonnet-4-6`, low effort, no settings loaded. Judges are Claude models on Claude text, so family bias is possible.

Replies, 8 chat questions with a jargon term each, two runs, [raw files and tables](evals/results/rebuild-2026-09-02/RESULTS.md). Counts are totals over the 16 replies. **95% fewer visible defects** (em-dashes, bold, headers, bullets) with 2.0.1 than with no skill (218 → 11). These counts come from the 2026-09-02 runs of 2.0.1, which still had the five-sentence reply cap that 2.1.0 removed. No run exists yet for 2.1.0 or later. A blind judge preferred 2.0.1 over 2.0.0 in 14 of 16 pairs.

| Condition | words | sentences | em-dashes | bold | headers | bullets |
|---|---:|---:|---:|---:|---:|---:|
| no skill | 216 | 16.8 | 62 | 79 | 25 | 52 |
| 2.0.0 | 184 | 14.4 | 43 | 72 | 4 | 52 |
| 2.0.1 | 146 | 7.9 | 5 | 2 | 0 | 4 |

On gpt-4.1-mini the same 8 questions went from 23 sentences, 64 bold spans, and 101 bullets per 8 replies. With 2.0.1 they went to 5.2 sentences and zero formatting.

Documents, the 8 sqlpipe writing tasks scored with the STE linter, one run per cell. One run moves by about 0.5 on this model, so read the rows as parity or better, not as a ranking.

| Condition | viol/100w | Reduction |
|---|---:|---:|
| no skill | 4.09 | |
| 1.3.0 | 2.11 | 48% |
| 2.0.0 | 1.70 | 58% |
| 2.0.1 | 0.91 | 78% |

The linter history: 81.3% fewer linter violations across 9 Claude models (144 generations, [RESULTS.md](evals/results/RESULTS.md)), plus Pi, opencode, and OpenAI runs in [`evals/results/`](evals/results/). Those numbers reproduce. A [2026-09-02 audit](evals/results/WHY-USELESS-2026-09-02.md) showed that they measure rule obedience, not what a reader sees, which is why 2.0.1 reports the reply counts above.

## The rules

Two registers in [`SKILL.md`](skills/simple-english/SKILL.md), about 1,700 tokens. The 53 numbered rules of Issue 9 live in [`rule-catalog.md`](skills/simple-english/references/rule-catalog.md) for check mode and Strict mode.

The reply, every chat answer:

| Rule | What it kills |
|---|---|
| Prose only: no headers, bullets, bold, tables | The wall of formatting around a one-line answer |
| First sentence answers | The preamble |
| No em-dashes | The spliced half-thought |
| Define a concept term in a few words | Jargon the reader has to look up |
| No contractions, openers, or closers | "Great question!" and "Hope this helps!" |

The document: docs, READMEs, runbooks, error messages, release notes:

| Rule | What it kills |
|---|---|
| Max 20 words per instruction, 25 per description | The run-on sentence |
| Condition before command | Trailing "...if the flag is set" that readers execute too late |
| Simple tenses, active voice | "has been updated", ", making it easy to..." |
| No should/would/may/might | Hedging. `can`, `will`, `must` survive |
| One word = one meaning, whole document | check/verify/confirm/validate roulette |
| Keep articles, keep "that" | Telegraph style. STE is short, not terse |
| No bold lead-ins, no heading over two sentences | Decoration that hides the fact |
| State the fact, not its importance | "crucial", "robust", "not just X, it is Y" |

Two modes. Plain, the default, is all of the above. Strict adds the STE dictionary discipline from [`strict-vocabulary.md`](skills/simple-english/references/strict-vocabulary.md) when you name STE, ASD-STE100, or compliance. The reply stays Plain in every mode.

## FAQ

Does this make output STE-certified? No. Nothing does, because ASD certifies no tool. Strict mode gets close. Word-level rulings live in the official standard, a [free download](https://www.asd-ste100.org/request.html).

Will my docs sound robotic? They will sound like Airbus manuals: flat and impossible to misread. For docs that is the whole point. Keep your voice for your blog.

Why not just prompt "write clearly"? "Clearly" is an opinion. "No sentence over 20 words" is a spec. Agents follow specs.

Why a 40-year-old aerospace standard? It is maintained (Issue 9, January 2025), numbered, and testable. It is also a near-perfect negative of every AI writing tell.

How was it built? Against the primary Issue 9 text, not summaries. A community audit ([#4](https://github.com/AminBlg/SimpleEnglish/issues/4)) checked the vocabulary tables against the dictionary. Scenarios and recorded results: [`evals/pressure-tests.md`](evals/pressure-tests.md).

## Star history

[![Star History Chart](https://api.star-history.com/chart?repos=AminBlg/SimpleEnglish&type=date&legend=top-left)](https://www.star-history.com/?repos=AminBlg%2FSimpleEnglish&type=date&legend=top-left)

## Word-choice linter

`evals/ste_lint.py` measures the mechanical rules and cannot see word choice. [`tools/ste-dictionary/`](tools/ste-dictionary/README.md) holds an extractor that builds the word lists from your own copy of the free Issue 9 PDF. A linter reads them. The repository ships the tool and no dictionary content, because the standard forbids reproduction without written authority from ASD.

## Contributing

Open an issue for questions and bug reports. Pull requests are welcome. A change that moves a published number ships the raw files with it, and `python3 evals/check_numbers.py` must pass. Run `python3 evals/ste_lint.py --self-test` before you push. Say in the PR whether an agent wrote the code, and do not add attribution trailers.

## License

MIT for everything here. The repo paraphrases the rules for teaching and reproduces no spec text or dictionary content. Unofficial project, not affiliated with or endorsed by ASD or STEMG. ASD-STE100 is a registered trademark of ASD.
