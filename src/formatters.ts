import type { ContextPackage } from "./types.js";

function codeFence(content: string): string {
  const runs = content.match(/`+/g) ?? [];
  const longestRun = runs.reduce((longest, run) => Math.max(longest, run.length), 0);
  return "`".repeat(Math.max(3, longestRun + 1));
}

export function formatMarkdown(context: ContextPackage): string {
  const lines = [
    `# Repository Context: ${context.projectName}`,
    "",
    `- Files scanned: ${context.scannedCount}`,
    `- High-relevance files selected: ${context.files.length}`,
    `- Files and directories excluded: ${context.excludedCount}`,
    `- Git status: ${context.gitAvailable ? "available" : "unavailable"} (${context.changedCount} changed paths)`,
    `- Approximate tokens: ${context.estimatedTokens}`,
  ];

  if (context.maxTokens !== undefined) {
    lines.push(`- Token budget: ${context.maxTokens}`);
  }
  if (context.task) {
    lines.push(`- Task: ${context.task}`);
  }
  if (context.projectHints.length > 0) {
    lines.push(`- Project hints: ${context.projectHints.join(", ")}`);
  }

  lines.push("", "## Selected Files");

  if (context.files.length === 0) {
    lines.push(
      "",
      "No high-relevance files were found. Try a more specific task or check the target directory.",
    );
  }

  for (const file of context.files) {
    const fence = codeFence(file.content);
    const language = file.extension.slice(1);
    lines.push(
      "",
      `### \`${file.relativePath}\``,
      "",
      `- Relevance score: ${file.score}`,
      `- Categories: ${file.categories.length > 0 ? file.categories.join(", ") : "none"}`,
      `- Why included: ${file.reasons.length > 0 ? file.reasons.join("; ") : "source file type"}`,
      "",
      `${fence}${language}`,
      file.content.replace(/\s+$/, ""),
      fence,
    );
  }

  if (context.omittedFiles.length > 0) {
    lines.push("", "## Omitted Files");
    for (const file of context.omittedFiles) {
      lines.push(`- \`${file.path}\` (score ${file.score}): ${file.reason}`);
    }
  }

  if (
    context.maxTokens !== undefined &&
    context.estimatedTokens > context.maxTokens
  ) {
    lines.push(
      "",
      `Warning: the package summary and omission report exceed the ${context.maxTokens}-token budget.`,
    );
  }

  return `${lines.join("\n")}\n`;
}

export function formatJson(context: ContextPackage): string {
  return `${JSON.stringify(
    {
      repository: context.projectName,
      task: context.task,
      scannedCount: context.scannedCount,
      excludedCount: context.excludedCount,
      git: {
        available: context.gitAvailable,
        changedCount: context.changedCount,
      },
      projectHints: context.projectHints,
      estimatedTokens: context.estimatedTokens,
      maxTokens: context.maxTokens,
      files: context.files.map((file) => ({
        path: file.relativePath,
        categories: file.categories,
        score: file.score,
        reasons: file.reasons,
        content: file.content,
      })),
      omittedFiles: context.omittedFiles,
    },
    null,
    2,
  )}\n`;
}
