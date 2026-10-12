#!/usr/bin/env node
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { formatMarkdown } from "./formatters.js";
import { rankFiles } from "./ranker.js";
import { scanRepository } from "./scanner.js";
import type { CliOptions, ContextPackage } from "./types.js";

const HELP_TEXT = `context-pack - package relevant repository context for an LLM

Usage:
  context-pack [--target <directory>] [--task <description>]

Options:
  --target <directory>  Project to scan (defaults to the current directory)
  --task <description>  Rank files against a short task description
  --help, -h            Show this help
`;

function requireValue(option: string, value: string | undefined): string {
  if (!value || value.startsWith("--")) {
    throw new Error(`${option} requires a value.`);
  }
  return value;
}

export function parseOptions(args: string[], cwd = process.cwd()): CliOptions {
  let target = cwd;
  let task: string | undefined;
  let help = false;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    switch (argument) {
      case "--target":
        target = path.resolve(cwd, requireValue(argument, args[index + 1]));
        index += 1;
        break;
      case "--task":
        task = requireValue(argument, args[index + 1]);
        index += 1;
        break;
      case "--help":
      case "-h":
        help = true;
        break;
      default:
        throw new Error(`Unknown option: ${argument}`);
    }
  }

  return { target, task, help };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function main(): Promise<void> {
  let options: CliOptions;
  try {
    options = parseOptions(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`Error: ${errorMessage(error)}\n\n${HELP_TEXT}`);
    process.exitCode = 1;
    return;
  }

  if (options.help) {
    process.stdout.write(HELP_TEXT);
    return;
  }

  process.stdout.write("Scanning repository structure...\n");
  try {
    const scan = await scanRepository(options.target);
    const rankedFiles = rankFiles(scan.files, options.task);
    const context: ContextPackage = {
      projectName: path.basename(scan.root),
      task: options.task,
      scannedCount: scan.scannedCount,
      excludedCount: scan.excludedCount,
      projectHints: scan.projectHints,
      files: rankedFiles,
    };
    const markdown = formatMarkdown(context);
    const outputPath = path.join(scan.root, ".context-pack.md");

    process.stdout.write(
      `Scanned ${scan.scannedCount} files; selected ${rankedFiles.length} high-relevance files; excluded ${scan.excludedCount} files/directories.\n`,
    );
    if (scan.projectHints.length > 0) {
      process.stdout.write(`Project hints: ${scan.projectHints.join(" / ")}\n`);
    }
    for (const warning of scan.warnings) {
      process.stderr.write(`Warning: ${warning}\n`);
    }
    process.stdout.write(`\n${markdown}`);
    await writeFile(outputPath, markdown, "utf8");
    process.stdout.write(`Saved context package to ${outputPath}\n`);
  } catch (error) {
    process.stderr.write(`Error: ${errorMessage(error)}\n`);
    process.exitCode = 1;
  }
}

void main();
