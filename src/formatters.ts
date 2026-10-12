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
  ];

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

  return `${lines.join("\n")}\n`;
}
