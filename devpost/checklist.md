---
doc: checklist
status: approved
---

# Build Checklist

Build mode: fast

## Slices

- [x] **1. Scan a repository and save task-aware Markdown context**
  Becomes usable: A compiled CLI scans a target project, ranks eligible files using the optional task and structural clues, explains its choices, prints a compact Markdown package, and saves `.context-pack.md`.
  Why now: This delivers the unique kernel early as a complete, runnable workflow; project setup is included rather than isolated from a usable result.
  PRD ref: `prd.md > The Core Journey`; `prd.md > Features and Behavior > Repository and Diff Scanning`; `prd.md > Features and Behavior > Relevance Heuristics`; `prd.md > Features and Behavior > Context Output Package`
  Spec ref: `spec.md > Stack`; `spec.md > Components > CLI Entry and Option Validation`; `spec.md > Components > Repository Scanner`; `spec.md > Components > Relevance Ranker`; `spec.md > Components > Context Packager and Token Budget`; `spec.md > Components > Output Formatters`; `spec.md > File Structure`
  Build: Bootstrap the TypeScript ESM package and executable; implement validated `--target` and `--task` options, safe file filtering, explainable task/path/header and structural ranking, Markdown rendering, terminal summary, and artifact save. Add focused tests for scanning exclusions and task/structural ranking.
  Verify (mechanical): Run `npm run build` and `npm test`; run the compiled CLI against a small fixture project with `--task "add auth middleware"`; confirm matching files and reasons appear, `.context-pack.md` is written, and `.env`/noise directories are excluded.
  Learner check: Run the CLI against the fixture and inspect the ranked list and saved package. Point out one inclusion that seems useful and any important file that seems missing or noisy.
  Commit: `Build task-aware Markdown context pack`

- [x] **2. Prioritize Git changes and support diff focus**
  Becomes usable: Changed files receive an explainable ranking boost; `--diff` focuses on changed files and nearby context, while clean or non-Git directories fall back to structural ranking.
  Why now: The basic context workflow is already usable, so Git behavior can be added and verified without making the core ranking depend on Git.
  PRD ref: `prd.md > The Core Journey`; `prd.md > Features and Behavior > Repository and Diff Scanning`; `prd.md > Features and Behavior > Relevance Heuristics`; `prd.md > States and Boundaries`
  Spec ref: `spec.md > Components > Repository Scanner`; `spec.md > Components > Relevance Ranker`; `spec.md > Important Failure Modes`
  Build: Read changed paths through the Git CLI without a shell; when `--task` is supplied, let task matches control selection, use structural categories only as tie-breakers, and give changed task matches a smaller boost. Implement `--diff` to include changed files and directly related context regardless of task words; without task/diff, use Git and structural fallback.
  Verify (mechanical): Run `npm run build` and `npm test`; automated tests create temporary Git and non-Git fixtures to verify changed-file prioritization, task-match filtering, explicit diff inclusion, and clean-tree fallback.
  Learner check: Run once against a changed fixture and once against a clean or non-Git fixture; check that the output explains the different ranking basis rather than failing when there are no changes.
  Commit: `Add Git-aware context ranking`

- [x] **3. Add JSON output and whole-file token budgeting**
  Becomes usable: The user can select JSON output and optionally cap the approximate bundle size; the CLI keeps source files whole, reports omissions, and documents how to try the tool.
  Why now: The baseline and Git-aware behaviors are already working; this completes output flexibility and the bundle-size control without obscuring the core ranking behavior.
  PRD ref: `prd.md > Features and Behavior > Context Output Package`; `prd.md > States and Boundaries`; `prd.md > What We're Building`
  Spec ref: `spec.md > Components > Context Packager and Token Budget`; `spec.md > Components > Output Formatters`; `spec.md > Important Failure Modes`; `spec.md > Where It Runs and How Someone Tries It`
  Build: Implement the approximate `ceil(characters / 4)` estimate and `--max-tokens` cap with whole-file inclusion in relevance order; render JSON with bundle metadata, file reasons, and content; report files omitted by the cap; add usage and demo instructions to the README.
  Verify (mechanical): Run `npm run build` and `npm test`; run Markdown and JSON commands with and without a cap, parse the JSON output, confirm the saved artifact matches the chosen format, and verify no included file is truncated or pushes the estimate beyond the cap.
  Learner check: Try a small token cap and inspect the terminal warning, omitted-file list, and artifact; then try `--format json` and confirm it contains the same selected context in structured form.
  Commit: `Add JSON output and token budget`

## Hands-on Checkpoints

- [x] Early usable behavior explored — after slice 1; learner confirmed task-matching files rank usefully and requested less unrelated structural-only context.
- [x] Final kick-the-tires exploration and feedback completed — learner exercised Markdown and JSON flows, a one-token cap, and an invalid target; all behaved as expected.

## Final Review

- [x] Final review complete — learner confirmed the CLI is ready for Devpost; no revisions requested.

Review outcome: Markdown and JSON packages were generated with task-relevant ranking and inclusion reasons; `--max-tokens 1` reported omissions without truncation; a missing target exited cleanly with code 1 and no stack trace. Learner confirmed the PoC is ready to submit.

## Code Tour and App Map

- [x] Learning activity complete — prior practice connected through the feedback-to-test example
- [x] Optional edit and transfer reflection addressed — edit not applicable; transfer question offered, learner redirected to submission drafting
- [x] `devpost/app-map.html` generated from finished code, checked, and shown, including a project-grounded practice to reuse

Activity and evidence: Connected the early Slice 1 feedback to the task-selection rule in `src/ranker.ts` (`rankFiles()`) and its regression test, `test/ranker.test.ts`; the final terminal review also confirmed the Markdown/JSON outputs, whole-file omission at a one-token cap, and clean invalid-target failure.
Route and stops: Reference route only, not toured interactively: `src/cli.ts` (`parseOptions()`, `main()`) -> `src/scanner.ts` (`scanRepository()`) and `src/ranker.ts` (`rankFiles()`) -> `src/packager.ts` (`packageContext()`) and `src/formatters.ts` (`formatMarkdown()`, `formatJson()`). The map was rendered and checked in the browser.
Edit outcome: Not applicable; no optional code edit was requested.
Reflection: Offered; no answer recorded because the learner redirected to submission drafting. No personal reflection recorded.
Activity mode: Prior build practice connected; standalone app map generated, opened, and checked.

## Revisions

- Task-aware selection refined after the first hands-on check — structural-only config/schema files could appear even when `--task` was supplied; task matches now control inclusion, structural roles break ties, Git-modified task matches get a smaller boost, and explicit `--diff` includes changed files and direct neighbors.
