---
doc: prd
status: approved
---

# Repo Context Packager for LLM-Assisted Coding — Product Requirements

A Node.js CLI that helps developers package the most relevant repository context for AI-assisted coding workflows, without dumping an entire project into an LLM prompt. Source: `scope.md > The Unique Kernel`, `The Core Loop`, `What "Working" Looks Like`, and `The POC Boundary`.

## The Core Journey

1. The developer opens a terminal in a project folder or points the CLI at a repository path.
2. They run the command, such as `npx context-pack` or `node bin/cli.js`, optionally with flags for diff mode, output format, or token budget.
3. The tool scans the repository structure and, when relevant, diffs the current working tree against git to understand what changed.
4. It filters out noisy files such as lockfiles, build artifacts, caches, and dependency folders, then ranks likely-relevant files by heuristics such as path names, file type, changed-file status, config usage, tests, schemas, and nearby modules.
5. The CLI presents a compact summary of the selected context: the most relevant files, why they were selected, and any detected architecture signals or schema hints.
6. It emits a clean Markdown and/or JSON context package, ready to paste into a coding assistant or save as a local artifact.
7. The developer uses that output to ask a better question, fix a bug, review a change, or plan a feature without manually assembling repo context by hand.

This is successful when the user sees a short, relevant, high-signal bundle instead of a noisy full repo dump.

## Screens and Layout

This product is terminal-first, so the “screen” is the CLI output itself. It has three primary interaction surfaces:

1. Terminal startup summary
   - command name
   - target directory or git diff
   - scan status and counts
   - stack or repo hints when detected

2. Ranked context preview
   - a compact list of selected files/modules
   - a short explanation of why each item mattered
   - output size or token estimate for the generated bundle

3. Output package artifact
   - Markdown file, JSON file, or both
   - copy-to-clipboard option when supported by the shell environment
   - path to saved artifact for reuse

There are no visual screens or UI flows beyond the terminal. The important layout is clarity, compressed structure, and fast readability in a demo or terminal recording.

## Look and Feel

The CLI should feel pragmatic, technical, and professional. It should not look like a toy script. Output should be concise, structured, and easy to scan in a terminal, with a clear hierarchy of headings, file paths, and relevance annotations.

- crisp and readable terminal formatting
- clear distinction between “selected context” and “noise filtered out”
- calm, technical tone rather than playful or gimmicky output
- output designed for copy/paste into AI tools
- small amount of polish for demo value without unnecessary visual complexity

## Features and Behavior

### Repository and Diff Scanning

The tool should operate in one of two modes:

- project directory mode: scan the codebase and gather likely context files
- git diff mode: analyze changed files and their immediate local context

The user can point the CLI at a folder or run it inside the working directory. The CLI should identify obvious repo structure and ignore irrelevant directories by default.

- As a developer, I want to run the CLI in my project root so I can get a relevant context package without manual file hunting.
  - [ ] The CLI accepts a target directory or defaults to the current working directory.
  - [ ] The CLI detects and filters out noisy paths such as node_modules, dist, build output, vendor directories, and large binary assets.
  - [ ] If a git repo is present, the tool can use git status/diff to understand recent changes.

### Relevance Heuristics

The tool should rank files and modules using simple, explainable rules rather than opaque AI scoring.

When a task description is provided, task-word matches against paths and file headers drive relevance and selection. Structural roles such as config, schemas, models, routes, entrypoints, and tests refine ranking among task-relevant files; a structural label alone does not make a file relevant to that task. Git-modified task matches can receive a smaller additional boost. Explicit `--diff` focus includes changed files and directly related context even when their text does not match the task. Without a task or explicit diff focus, Git changes and structural clues provide the fallback ranking.

- As a developer, I want the selected files to reflect the actual task area so the AI gets useful context instead of repo noise.
  - [ ] The CLI assigns a relevance score or priority level to files/modules.
  - [ ] The output explains why a file was included, using human-readable signals such as path, file type, or recent change status.
  - [ ] Low-signal files are omitted or placed lower in the output.

### Context Output Package

The tool should generate a compact package that is immediately usable by an LLM. This can be emitted in Markdown and/or JSON.

The package must include:

- repo or diff summary
- selected relevant files
- file-level reasons for inclusion
- module or schema highlights
- a short description of the likely task context
- optional token estimate or size indicator for the final bundle

- As a developer, I want a ready-to-paste AI context bundle so I can drop it directly into a coding assistant.
  - [ ] The resulting output is structured and readable by both humans and AI tools.
  - [ ] The default output format is compact and prompt-friendly.
  - [ ] The CLI can save the artifact to a file such as `.context-pack.md` or a JSON variant.

### Clipboard or Copy Workflow

The tool should make it faster to use the result. In supported terminals or environments, it may copy the generated Markdown summary to the clipboard.

- As a developer, I want a fast path from analysis to prompt so that the core workflow takes seconds, not manual assembly.
  - [ ] The CLI offers a way to copy the generated summary to the clipboard when the environment supports it.
  - [ ] The artifact is still saved locally even if clipboard support is unavailable.

## States and Boundaries

- **First run** — the user runs the CLI in an empty or normal project and sees scan progress, relevance results, and the final context bundle.
- **Normal use** — the tool reads the codebase or diff and outputs a curated summary without requiring extra setup.
- **No relevant files found** — the CLI reports a low-confidence or empty result and explains why, without failing mysteriously.
- **Git diff mode with no changes** — the tool should return a useful message such as “No current git diff detected; showing default repo summary instead” or “No changes to package.”
- **Repo scan errors** — if the path is invalid, unreadable, or not a repo, the CLI returns a concise error and exits cleanly.
- **Token budget warning** — if the generated bundle is large, the tool surfaces the estimate and suggests reducing scope or choosing a more focused mode.

## Product Decisions

- CLI-first, not web-first — this is a developer utility optimized for a terminal workflow and a short terminal demo.
- Diff-aware context is important — the tool should help when a developer has a change in flight, not only when scanning an entire repo.
- Relevance should be explainable — user trust matters; the tool should show why files were selected rather than behaving like a black box.
- Task terms drive selection when supplied; structural file categories break ties rather than pulling unrelated files into the bundle.
- Output should be prompt-ready and copy-friendly — the main value is compressing repo context into a usable LLM bundle.
- The scope stays intentionally limited to heuristics, not semantic embeddings or model-driven query expansion.

## What We're Building

The proof of concept must be able to:

- scan a local project directory or git diff
- ignore obvious noise and large irrelevant directories
- rank files/modules using basic, explainable heuristics
- output a clean, compact LLM-ready context package in Markdown and/or JSON
- make the result easy to use in a terminal recording or direct AI prompt workflow

## Deferred From the POC

- semantic search or embedding-based retrieval
- deep project graph analysis across transitive dependencies
- automatic model invocation or direct prompt execution
- web UI, dashboard, or browser-based companion
- automated code patching or file editing
- cloud sync, team collaboration, or repo-private indexing
- persistent project profiles or stored history across sessions

## Possible Later Enhancements

- smarter scoring using embeddings or semantic similarity
- project-specific context templates for backend, frontend, NLP, or ML repos
- configurable heuristics and scoring rules
- CI integration for automated PR context generation
- support for multiple output formats tailored to ChatGPT, Claude, Copilot, and internal tools

## Non-Goals

- building a full AI coding agent
- replacing the developer’s judgment with automatic code generation
- implementing a search engine, vector database, or full repo indexing service
- shipping a multi-user SaaS product
- creating a visual dashboard or browser frontend

## Open Questions

- Does the CLI need both Markdown and JSON output by default, or is Markdown the primary artifact with JSON as optional? This can be resolved during the technical planning phase.
- Should the default behavior favor a “changes-only” mode or a broader repo summary mode when no diff exists? This is a product choice that can be decided in the spec stage.
- Do we want a copy-to-clipboard option in the default path or as a flag only? This is a low-risk UX decision and can be resolved without changing the product plan.
