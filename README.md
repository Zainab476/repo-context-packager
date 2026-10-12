# Context Pack

A local CLI that selects high-signal repository context for LLM-assisted coding. It filters common repository noise, explains why files were selected, and saves a Markdown or JSON package you can paste into an AI coding tool.

## Requirements

- Node.js 24 or newer
- Git is optional; without it, the CLI reports that Git-based ranking is unavailable and continues with task or structural ranking.

## Install and build

```powershell
npm install
npm run build
npm link
```

`npm link` makes the `context-pack` command available locally. To run without linking:

```powershell
node "C:\path\to\context-pack\dist\cli.js" --target "C:\path\to\project"
```

## Use

Run in a project directory, or supply `--target`:

```powershell
context-pack --task "add auth middleware"
context-pack --target "C:\path\to\project" --task "update session handling" --diff
context-pack --task "add auth middleware" --format json
context-pack --task "add auth middleware" --max-tokens 4000
```

Options:

- `--target <directory>` scans the specified directory; defaults to the current directory.
- `--task <description>` ranks files using task-word matches in paths and file headers. Structural categories refine ranking but do not independently select files.
- `--diff` focuses on Git-changed files and directly imported neighbors. If no eligible changes are found, the CLI explains the fallback.
- `--format <markdown|json>` selects the output format; Markdown is the default.
- `--max-tokens <count>` applies an approximate bundle-size budget. Files are kept whole and lower-ranked files are omitted with reasons.
- `--help` shows usage.

Git changes receive a secondary boost when they also match the task. Without task or diff focus, changed files and structural clues provide the fallback ranking. The tool uses lightweight heuristics rather than embeddings or a full dependency graph.

Markdown output is saved as `.context-pack.md`; JSON output is saved as `.context-pack.json`. Generated packages are excluded from later scans. With `--format json`, standard output contains only the JSON package; progress and save information go to standard error.

The token count is an approximation based on the serialized output length divided by four, not a model-specific tokenizer. `--max-tokens` never truncates file contents. The estimate includes package metadata and the omission report, so those can exceed a very small budget even when no files fit.

## Verify and demo

```powershell
npm test
context-pack --target .\test\fixtures\sample-project --task "add auth middleware"
```

Show the ranked file paths and inclusion reasons, then open the generated `.context-pack.md`. For a Git demo, make a change in a small Git project and try `--diff`; for structured output, try `--format json` and inspect `.context-pack.json`.

The scanner runs locally and does not upload source files. It excludes common credentials, dependency/build directories, binary files, lockfiles, and generated context artifacts.
