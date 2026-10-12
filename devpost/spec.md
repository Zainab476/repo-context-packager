---
doc: spec
status: approved
---

# Repo Context Packager — Technical Spec

## How This Works, In Plain Language

The user runs `context-pack` in a project and can optionally describe their task with `--task`. The CLI walks the project files, skips common noise and sensitive files, and asks Git which files have changed when Git is available. It gives each remaining file a simple, explainable relevance score: task words in its path or opening lines, whether it changed, and whether its name or location suggests an entry point, schema, config, or test.

The highest-ranked whole files go into a Markdown or JSON bundle. The tool estimates tokens by dividing the bundle’s character count by four. If a `--max-tokens` limit is set, it adds files in ranking order and stops before the next whole file would exceed the limit; it never chops code in half. Finally, it shows the summary and bundle in the terminal and saves the artifact in the scanned project’s root.

There is no AI model, server, account, or cloud service involved. TypeScript types help keep the file and scoring data consistent, and compiling TypeScript creates the JavaScript that Node runs. This keeps the product focused on explainable context selection instead of adding infrastructure or model behavior.

## The Core Journey Through the System

Implements `prd.md > The Core Journey`.

1. The developer runs the CLI in a repository, optionally providing a target directory, task description, output format, or token cap.
2. `cli.ts` validates the options, prints a short scan status, and passes them to the scanner.
3. `scanner.ts` walks eligible text files and asks Git for changed paths if the target is a Git repository. Without a task description, changed files receive priority; if there are no changes or Git is unavailable, structural file clues still allow a useful ranking.
4. `ranker.ts` uses task-word matches in paths and the first lines of files to qualify files when `--task` is supplied; structural clues then break ties, and Git-modified task matches get a smaller recency boost. Explicit `--diff` includes changed files and directly related files even without task-word matches. Without a task or explicit diff focus, Git changes and structural clues provide the fallback. The ranker records readable reasons and returns a stable highest-first list.
5. `packager.ts` reads the candidate file contents, prepares each complete file entry and a rough token estimate, and applies the optional cap in relevance order. Files that do not fit, and all lower-ranked files, are reported as omitted.
6. `formatters.ts` renders the bundle as Markdown by default or JSON when requested. `cli.ts` prints the result and saves it in the target project root as `.context-pack.md` or `.context-pack.json`.

```text
CLI options
    ↓
Scan eligible files + Git changes
    ↓
Rank with task/path/header/structure clues
    ↓
Select whole files within optional token cap
    ↓
Render Markdown or JSON → print + save in target project
```

## Stack

- **Node.js 24 LTS** — local command-line runtime. It provides the file, path, and child-process APIs needed for scanning and calling Git. Node.js 24 is listed as LTS in the [official release schedule](https://nodejs.org/en/about/previous-releases).
- **TypeScript** — the learner-selected implementation language for explicit types around scan results, scores, and bundles. It compiles to JavaScript before the CLI runs. Use the current stable compiler and pin the resolved version in the lockfile; see the [TypeScript documentation](https://www.typescriptlang.org/docs/).
- **`@types/node`** — development-only type definitions for Node.js built-ins, pinned in the lockfile. See [DefinitelyTyped’s Node.js types](https://www.npmjs.com/package/@types/node).
- **Node.js built-ins** — `node:fs/promises`, `node:path`, and `node:child_process` handle file traversal, paths, and safe Git subprocess calls. No runtime package is required for CLI parsing, ranking, output formatting, or clipboard access (clipboard support is intentionally omitted). See the [Node.js API documentation](https://nodejs.org/docs/latest-v24.x/api/).
- **Node's built-in test runner** — use `node:test` for ranking, file filtering, and budget tests, avoiding a separate test framework. See the [Node.js test documentation](https://nodejs.org/docs/latest-v24.x/api/test.html).
- **Git CLI (optional at runtime)** — used to discover changed files. If Git is absent or the target is not a Git repository, scanning continues with file-structure heuristics. See [Git status](https://git-scm.com/docs/git-status).
- **No framework, model API, database, or hosted service.**

## Where It Runs and How Someone Tries It

The tool runs as a local Node.js process on the developer’s machine. It reads files from the chosen target directory and writes one context artifact into that directory. It does not upload source code. Node.js 24 LTS is the recommended runtime; Git is optional and only enables changed-file prioritization.

From the tool’s cloned repository in PowerShell:

```powershell
npm install
npm run build
npm link
```

Then, from the project to inspect:

```powershell
context-pack --task "add auth middleware" --max-tokens 4000
```

The command defaults to the current directory, Markdown output, and no token cap unless one is provided. `--task` adds task-word matching. Git changes are considered by default; `--diff` makes changed files the focus while retaining directly related files where found. To inspect another directory, pass `--target "C:\path\to\project"`. To request JSON, pass `--format json`. `npm link` makes the command available locally for the demo without publishing it; the package’s `bin` entry maps `context-pack` to the compiled CLI. See npm’s [`bin` package.json documentation](https://docs.npmjs.com/cli/v11/configuring-npm/package-json#bin).

For a direct run without linking, build and run `node <tool-repository>\dist\cli.js --target <project-path>`. A short terminal recording should show the command, scan summary, ranked files and reasons, token estimate/cap behavior, and the saved `.context-pack.md` (or JSON artifact). The submission still needs a short demo video and a public GitHub repository; deployment is optional and is not part of this local CLI.

Public GitHub repository: https://github.com/Zainab476/repo-context-packager

`npx context-pack` from a fresh machine requires a published or installed npm package. Publishing to npm is outside this proof of concept; use `npm link` or the direct Node command for the demo.

## Look and Feel

Use concise, professional terminal text with clear headings and readable relative paths. Print a short “Scanning repository…” status, then scanned/selected counts, any detected project hints, each selected file’s inclusion reasons, the approximate token count, omitted-file warnings, and the artifact path. Show the Markdown or JSON package after the summary so it can be inspected or copied manually. Avoid requiring colored output, animation, or clipboard integration.

The Markdown artifact is `.context-pack.md` by default; `--format json` writes `.context-pack.json`. The generated artifact itself is excluded from later scans.

## Components

### CLI Entry and Option Validation — `src/cli.ts`

Parses and validates `--target`, `--task`, `--diff`, `--format`, and `--max-tokens`; coordinates the scan, ranking, packaging, formatting, terminal output, and artifact write. Invalid paths, formats, or token limits produce a concise message and a non-zero exit status.

Implements `prd.md > Screens and Layout`, `Repository and Diff Scanning`, `Context Output Package`, `Clipboard or Copy Workflow` (terminal display and local save only), and `States and Boundaries`.

### Repository Scanner — `src/scanner.ts`

Walks the target directory and gathers eligible text-file paths and metadata. Excludes `.git`, dependency/build/cache directories, lockfiles, generated context artifacts, common binary files, oversized files, and common credential files such as `.env` (while allowing `.env.example`). It detects lightweight project hints from manifests such as `package.json` and `tsconfig.json`; it does not attempt exhaustive framework detection. If Git is available, obtains changed paths using a subprocess invoked without a shell. `--diff` makes changed paths the focus while still allowing directly related files to be included; if no Git changes are available, it reports that and falls back to structural ranking rather than failing.

Implements `prd.md > Repository and Diff Scanning` and `States and Boundaries`.

### Relevance Ranker — `src/ranker.ts`

Produces a score, structural category labels, and human-readable reasons for each candidate. With `--task`, normalized task words must match relative paths or the first 40 lines of eligible text files for a file to qualify; structural clues (entrypoints, schemas/models, routes, config, and tests) act only as tie-breakers. Git-modified task matches get a smaller secondary boost. `--diff` explicitly includes changed files and directly related files even when they do not match task words. Without a task or explicit diff focus, Git changes and structural signals provide the fallback ranking. Direct nearby-file clues may use matching directory/name or simple import-path references; this is not a parsed dependency graph. Equal scores use relative path order for stable output.

Implements `prd.md > Relevance Heuristics`.

### Context Packager and Token Budget — `src/packager.ts`

Reads complete eligible file contents and assembles the repository/diff summary, optional task description, scanned/selected counts, manifest hints, paths, category labels, scores, inclusion reasons, and content. Estimates tokens as `ceil(serialized character count / 4)`; this is an approximation, not a model-specific tokenizer. When `--max-tokens` is present, includes whole files in descending rank order and stops before the next file would exceed the cap. It records omitted files and the reason. No file is truncated.

Implements `prd.md > Context Output Package` and `States and Boundaries`.

### Output Formatters — `src/formatters.ts`

Formats the same bundle data as prompt-friendly Markdown by default or as structured JSON on request. JSON includes the summary and a `files` array with each path, category, score, reasons, and full included content; both formats include task/repository summary, scan counts, manifest hints, estimate, and omitted-file information.

Implements `prd.md > Context Output Package`.

## Data Model

No project data is kept between runs. During one process, typed in-memory objects carry:

- **Options** — target path, optional task text, diff focus, output format, and optional token cap. Created from command-line arguments and discarded when the process exits.
- **Candidate file** — normalized relative path, file size/type, changed status, and the small header excerpt used for task matching. Read from the target directory and Git; discarded after ranking/packaging.
- **Ranked file** — candidate metadata plus numeric score and inclusion reasons. Exists only during the run.
- **Context package** — scan summary, selected whole-file entries, omitted paths/reasons, and approximate token estimate. Rendered to terminal and written to `.context-pack.md` or `.context-pack.json` in the target project root. A later run starts fresh and regenerates the artifact.

Data flow: local files and optional Git status → candidate records → ranked records → whole-file package under optional cap → Markdown/JSON string → terminal and local artifact.

## File Structure

```text
context-packager/
├── src/
│   ├── cli.ts             # command entry, options, orchestration, terminal output
│   ├── scanner.ts         # directory traversal, file exclusions, optional Git status
│   ├── ranker.ts          # explainable relevance scoring
│   ├── packager.ts        # whole-file selection and token-cap enforcement
│   ├── formatters.ts      # Markdown and JSON renderers
│   └── types.ts           # shared option, candidate, ranking, and bundle types
├── test/
│   ├── scanner.test.ts    # ignore rules and Git/non-Git scanning behavior
│   ├── ranker.test.ts     # task and structural scoring cases
│   └── packager.test.ts   # approximate estimate and whole-file cap cases
├── test/fixtures/
│   └── sample-project/    # tiny repository for the learner's terminal check
├── devpost/               # learning plans; learner profile remains git-ignored
├── .gitignore             # excludes generated output/build and private profile
├── package.json           # ESM package, scripts, and context-pack executable mapping
├── package-lock.json      # reproducible dependency versions
├── tsconfig.json          # NodeNext TypeScript-to-JavaScript build
├── tsconfig.test.json     # compiles TypeScript tests without runtime tooling
└── README.md              # installation, command examples, demo instructions
```

`package.json` sets the package to ESM and maps the `context-pack` executable to compiled `dist/cli.js`. `tsconfig.json` uses NodeNext module settings with `dist/` as the output directory. The build preserves the CLI shebang so npm can create the platform command shim. `npm test` compiles the TypeScript tests and runs them with Node's built-in test runner. Generated `dist/` output and installed dependencies are not hand-maintained source files.

## External Services and Dependencies

- **External service calls:** none. No source code leaves the local machine.
- **Runtime dependency:** Node.js 24 LTS; no third-party runtime packages.
- **Development dependencies:** TypeScript and `@types/node`, installed and version-locked with npm. Their documentation is linked under `Stack`.
- **Optional executable:** Git CLI for changed-file detection; the scan falls back to structural clues if Git cannot be used.
- **Package distribution:** no npm publication is required for the hackathon. A local `npm link` is enough to demonstrate the command. npm package executable mapping documentation is linked under `Where It Runs and How Someone Tries It`.

## Important Failure Modes

- **Target path is missing, unreadable, or not a directory** → print a concise actionable error and exit non-zero; do not write an artifact.
- **Git is missing, the target is not a repository, or there are no changed files** → state that changed-file prioritization is unavailable and continue with structural/task ranking. In explicit diff focus with a clean tree, report no changes and fall back to repository ranking.
- **No eligible files or every file is excluded by the cap** → still print a clear empty/omitted result and reasons; do not claim a useful context pack was produced.
- **Artifact cannot be written** → report the path and filesystem error, exit non-zero, and do not present the save as successful.

## What Was Simplified and Why

- **Task-word/path/header heuristics plus Git and structural signals** instead of embeddings or model calls — keeps selection explainable, offline, and feasible within the PoC.
- **Only lightweight direct-neighbor clues** instead of a full language-aware dependency graph — avoids AST parsers and project-specific tooling while still supporting nearby context.
- **Approximate character-based token count (`characters / 4`)** instead of a model tokenizer — no tokenizer dependency or model-specific claim; the estimate is labeled approximate.
- **Whole-file omission under a token cap** instead of truncating file contents — preserves valid source context and makes any omissions visible.
- **Print and save instead of automatic clipboard integration** — avoids platform-specific behavior and external clipboard dependencies while keeping the bundle easy to copy from the terminal.
- **Local `npm link` demo instead of npm publication** — demonstrates a real executable without making registry publishing or package-name availability part of the hackathon.

## Decisions and Open Issues

- **Learner choice — TypeScript** for this Node.js CLI, accepting a compile step in exchange for types around file records, scores, and token estimates.
- **Learner choice — optional `--task`**: rank task-word matches against paths and file headers; without it, prioritize Git changes and structural clues.
- **Learner choice — task relevance refinement after the first hands-on check**: with `--task`, keyword matches control selection and structural categories only break ties; changed task matches receive a smaller boost. Explicit `--diff` includes changed and directly related files regardless of task words. Without a task or explicit diff focus, use Git-modified and structural fallback signals.
- **Learner choice — local Markdown artifact and terminal preview**; skip clipboard dependencies.
- **Learner choice — approximate token estimate and `--max-tokens`**; keep files whole, add them in relevance order, and report omissions.
- **Derived implementation choice — Node.js 24 LTS, TypeScript, and Node built-ins** to keep runtime dependencies and setup small. Tradeoff: use a basic argument parser and plain terminal formatting rather than framework-provided polish.
- **Uncertainty clarified — token estimate accuracy:** tokenization differs by model. The agreed `characters / 4` estimate is a useful size signal, not a guarantee that a bundle fits any particular model’s context window.
- **Demo distribution:** `npx context-pack` from a clean machine requires registry publication or installation. The PoC instead uses `npm link` or the direct compiled CLI; npm publication remains deferred.
- **PRD open question — Markdown versus JSON:** Markdown is the default and JSON is selected with `--format json`; only the chosen format is written in a run.
- **PRD open question — behavior without a task:** use changed-file and structural signals; if no changes are present, fall back to structural ranking.
- **PRD open question — clipboard:** resolved by the learner; no automatic copy, terminal output is copyable.
- **To verify early in the build:** confirm Node.js 24 and the current stable TypeScript compiler are installed, confirm the npm package name is available if it is ever published, and exercise the Git fallback on both a clean and changed working tree.
