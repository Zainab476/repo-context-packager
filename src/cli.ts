#!/usr/bin/env node
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { formatJson, formatMarkdown } from "./formatters.js";
import { packageContext } from "./packager.js";
import { rankFiles } from "./ranker.js";
import { scanRepository } from "./scanner.js";
import type { CliOptions, OutputFormat } from "./types.js";

const HELP_TEXT = `context-pack - package relevant repository context for an LLM

Usage:
  context-pack [--target <directory>] [--task <description>] [--diff]
               [--format <markdown|json>] [--max-tokens <count>]

Options:
  --target <directory>  Project to scan (defaults to the current directory)
  --task <description>  Rank files against a short task description
  --diff                Focus on Git changes and directly related files
  --format <format>     Output format: markdown (default) or json
  --max-tokens <count>  Approximate bundle budget; files are kept whole
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
  let diff = false;
  let format: OutputFormat = "markdown";
  let maxTokens: number | undefined;
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
      case "--diff":
        diff = true;
        break;
      case "--format": {
        const value = requireValue(argument, args[index + 1]);
        if (value !== "markdown" && value !== "json") {
          throw new Error('--format must be either "markdown" or "json".');
        }
        format = value;
        index += 1;
        break;
      }
      case "--max-tokens": {
        const value = requireValue(argument, args[index + 1]);
        const parsed = Number(value);
        if (!/^\d+$/.test(value) || !Number.isSafeInteger(parsed) || parsed < 1) {
          throw new Error("--max-tokens must be a positive safe integer.");
        }
        maxTokens = parsed;
        index += 1;
        break;
      }
      case "--help":
      case "-h":
        help = true;
        break;
      default:
        throw new Error(`Unknown option: ${argument}`);
    }
  }

  return { target, task, diff, format, maxTokens, help };
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

  const statusOutput = options.format === "json" ? process.stderr : process.stdout;
  statusOutput.write("Scanning repository structure...\n");
  try {
    const scan = await scanRepository(options.target);
    const eligibleChangedCount = scan.files.filter((file) => file.changed).length;
    if (options.diff && eligibleChangedCount === 0) {
      scan.warnings.push("No eligible Git changes found for --diff; falling back to repository ranking.");
    }
    const rankedFiles = rankFiles(scan.files, {
      task: options.task,
      diff: options.diff,
    });
    const context = packageContext(
      {
        projectName: path.basename(scan.root),
        task: options.task,
        scannedCount: scan.scannedCount,
        excludedCount: scan.excludedCount,
        gitAvailable: scan.gitAvailable,
        changedCount: scan.changedPaths.length,
        projectHints: scan.projectHints,
      },
      rankedFiles,
      { format: options.format, maxTokens: options.maxTokens },
    );
    const output = options.format === "json" ? formatJson(context) : formatMarkdown(context);
    const outputPath = path.join(
      scan.root,
      options.format === "json" ? ".context-pack.json" : ".context-pack.md",
    );

    const summary =
      `Scanned ${scan.scannedCount} files; Git status ${scan.gitAvailable ? "available" : "unavailable"} with ${scan.changedPaths.length} changed paths; ` +
      `selected ${context.files.length} high-relevance files; estimated ${context.estimatedTokens} tokens; ` +
      `excluded ${scan.excludedCount} files/directories.`;
    const summaryOutput = options.format === "json" ? process.stderr : process.stdout;
    summaryOutput.write(`${summary}\n`);
    if (context.omittedFiles.length > 0) {
      process.stderr.write(
        `Warning: omitted ${context.omittedFiles.length} whole file(s) to respect the token budget.\n`,
      );
    }
    if (
      context.maxTokens !== undefined &&
      context.estimatedTokens > context.maxTokens
    ) {
      process.stderr.write(
        `Warning: package summary and omission report exceed the ${context.maxTokens}-token budget.\n`,
      );
    }
    if (scan.projectHints.length > 0 && options.format !== "json") {
      process.stdout.write(`Project hints: ${scan.projectHints.join(" / ")}\n`);
    }
    for (const warning of scan.warnings) {
      process.stderr.write(`Warning: ${warning}\n`);
    }

    await writeFile(outputPath, output, "utf8");
    if (options.format === "json") {
      process.stdout.write(output);
      process.stderr.write(`Saved context package to ${outputPath}\n`);
    } else {
      process.stdout.write(`\n${output}`);
      process.stdout.write(`Saved context package to ${outputPath}\n`);
    }
  } catch (error) {
    process.stderr.write(`Error: ${errorMessage(error)}\n`);
    process.exitCode = 1;
  }
}

void main();
