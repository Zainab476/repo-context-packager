# Context Pack

Context Pack is a local TypeScript CLI for preparing focused repository context for LLM-assisted coding.

## The problem

Coding tasks often depend on a small part of a repository, while a full-repository dump can overwhelm an LLM prompt and consume its token budget with unrelated files. Context Pack scans a project and produces a ranked, explainable bundle so a developer can provide relevant code without manually assembling it.

## What it does

- Matches task keywords against file paths and the first 40 lines of file content.
- Uses file roles such as entrypoints, routes, schemas, configuration, and tests as explainable ranking signals.
- Uses Git changes to prioritize relevant in-flight work; `--diff` focuses on changed files and directly related imports.
- Estimates the serialized package size at approximately four characters per token and, when capped, includes or omits complete files rather than truncating code.
- Prints the context package and saves it locally as Markdown or JSON.

No source is uploaded. The CLI does not call an LLM, use embeddings, or build a full dependency graph.

## How it works

```text
CLI options
    -> scan eligible files and optional Git changes
    -> rank with task, structural, and diff signals
    -> package complete files within the optional budget
    -> format as Markdown or JSON, print, and save
```

The implementation separates these responsibilities:

| Component | Responsibility |
| --- | --- |
| `src/cli.ts` | Validates command-line options and coordinates scanning, ranking, packaging, and output. |
| `src/scanner.ts` | Finds eligible files, applies built-in exclusions, detects project hints, and reads optional Git status. |
| `src/ranker.ts` | Scores files with task/path/header matches, structural clues, changed-file signals, and direct import neighbors. |
| `src/packager.ts` | Estimates serialized tokens and selects whole files in relevance order under the optional cap. |
| `src/formatters.ts` | Renders the package as prompt-friendly Markdown or structured JSON. |

Ranking is heuristic and explainable. Task matches control selection when `--task` is supplied; structural categories refine the order. Changed task matches receive a secondary boost. With no task, changed files and structural signals provide the fallback. Git is optional, and the CLI continues with non-Git ranking when Git status is unavailable.

## Requirements

- Node.js 24 or newer.
- Git is optional and only enables changed-file prioritization.

There are no runtime package dependencies. TypeScript, Node.js type definitions, and Node's built-in test runner are used for development and tests.

## Install and build

From the cloned repository:

```powershell
npm ci
npm run build
npm link
```

`npm link` makes the `context-pack` command available locally. To run the compiled CLI without linking:

```powershell
node "C:\path\to\context-pack\dist\cli.js" --target "C:\path\to\project"
```

## Usage

Run from the project to inspect, or pass its path with `--target`. The target defaults to the current directory; Markdown is the default output format.

```powershell
# Rank files for a task and limit the approximate package size.
context-pack --target "C:\work\service" --task "add auth middleware" --max-tokens 4000

# Focus on Git changes and directly related files.
context-pack --target "C:\work\service" --diff

# Write and print a structured JSON package.
context-pack --target "C:\work\service" --task "update session handling" --format json

# Combine diff focus, a task, a token cap, and JSON output.
context-pack --target "C:\work\service" --task "fix session auth" --diff --max-tokens 4000 --format json
```

| Option | Description |
| --- | --- |
| `--target <directory>` | Directory to scan. Defaults to the current working directory. |
| `--task <description>` | Optional task words used to match paths and file headers. |
| `--diff` | Focus on eligible changed files and direct import neighbors. With no eligible changes, reports the fallback and ranks the repository. |
| `--format <format>` | Accepts `markdown` or `json`; Markdown is the default. |
| `--max-tokens <count>` | Positive integer budget based on an approximate serialized character count. Files remain whole; lower-ranked files are omitted with reasons. |
| `--help`, `-h` | Print command usage. |

## Output and token budgeting

- Markdown is saved to `.context-pack.md`; JSON is saved to `.context-pack.json` in the target project root.
- The generated context artifacts are excluded from later scans.
- The terminal shows scan counts, selected paths and reasons, the estimate, warnings, and the package. For JSON, standard output contains the JSON package; progress and save information are written to standard error.
- The estimate is `ceil(serialized characters / 4)`. It is a rough size indicator, not a model-specific tokenizer.
- Under `--max-tokens`, files are considered in relevance order and included whole only when they fit. Omitted files are reported. Package metadata and the omission report can exceed an extremely small cap even when no source files fit.

The scanner applies built-in exclusions for common noise and sensitive files, including dependency/build/cache directories, lockfiles, binary and oversized files, and common credentials such as `.env` (while allowing `.env.example`). Git status, when available, is obtained locally. The tool does not upload repository contents.

## Test

```powershell
npm test
```

The command builds the TypeScript sources and tests, then runs the Node.js built-in test runner. Tests cover file filtering and Git/non-Git scanning, task and structural ranking, diff-related selection, JSON formatting, token estimates, and whole-file budget behavior.

## Proof-of-concept boundaries

Context Pack uses lightweight keyword, path, file-role, and Git heuristics. It does not perform semantic search, embedding-based retrieval, complete dependency analysis, remote processing, or automatic code changes. The approximate token budget is intended to guide prompt preparation, not guarantee a model's exact token count.
