import type { FileCandidate, FileCategory, RankedFile } from "./types.js";

const GENERIC_TASK_WORDS = new Set([
  "add",
  "change",
  "create",
  "fix",
  "implement",
  "make",
  "remove",
  "update",
]);

const CATEGORY_SCORES: Record<Exclude<FileCategory, "source" | "documentation">, number> = {
  entrypoint: 3,
  schema: 4,
  route: 3,
  config: 2,
  test: 1,
};

function getTaskWords(task?: string): string[] {
  if (!task) {
    return [];
  }

  return [
    ...new Set(
      (task.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter(
        (word) => word.length > 1 && !GENERIC_TASK_WORDS.has(word),
      ),
    ),
  ];
}

function getPathWords(relativePath: string): Set<string> {
  return new Set(relativePath.toLowerCase().match(/[a-z0-9]+/g) ?? []);
}

export function rankFiles(files: FileCandidate[], task?: string): RankedFile[] {
  const taskWords = getTaskWords(task);

  return files
    .map((file): RankedFile => {
      let score = 0;
      const reasons: string[] = [];

      if (file.categories.includes("source")) {
        score += 1;
      }

      for (const category of file.categories) {
        if (category === "source" || category === "documentation") {
          continue;
        }
        score += CATEGORY_SCORES[category];
        reasons.push(`Recognized as ${category}`);
      }

      if (file.changed) {
        score += 10;
        reasons.push("Changed in the current Git worktree");
      }

      const pathWords = getPathWords(file.relativePath);
      const headerWords = new Set(
        file.content
          .split(/\r?\n/)
          .slice(0, 40)
          .join(" ")
          .toLowerCase()
          .match(/[a-z0-9]+/g) ?? [],
      );

      for (const word of taskWords) {
        if (pathWords.has(word)) {
          score += 4;
          reasons.push(`Task term "${word}" matches the path`);
        }
        if (headerWords.has(word)) {
          score += 2;
          reasons.push(`Task term "${word}" matches the file header`);
        }
      }

      return { ...file, score, reasons };
    })
    .filter((file) => file.score >= 2)
    .sort(
      (left, right) =>
        right.score - left.score || left.relativePath.localeCompare(right.relativePath),
    );
}
