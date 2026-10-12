import path from "node:path";
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

const IMPORT_PATTERN =
  /(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*)["'](\.{1,2}\/[^"']+)["']/g;
const SOURCE_EXTENSIONS = [
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".py",
  ".go",
  ".rs",
  ".java",
];

export interface RankOptions {
  task?: string;
  diff?: boolean;
}

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

function getStructuralScore(file: FileCandidate): number {
  return file.categories.reduce((score, category) => {
    if (category === "source" || category === "documentation") {
      return score;
    }
    return score + CATEGORY_SCORES[category];
  }, 0);
}

function getTaskMatch(file: FileCandidate, taskWords: string[]): {
  score: number;
  reasons: string[];
} {
  const pathWords = getPathWords(file.relativePath);
  const headerWords = new Set(
    file.content
      .split(/\r?\n/)
      .slice(0, 40)
      .join(" ")
      .toLowerCase()
      .match(/[a-z0-9]+/g) ?? [],
  );
  const reasons: string[] = [];
  let score = 0;

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

  return { score, reasons };
}

function getImportPaths(file: FileCandidate): string[] {
  const paths: string[] = [];
  for (const match of file.content.matchAll(IMPORT_PATTERN)) {
    const specifier = match[1];
    if (specifier) {
      paths.push(
        path.posix.normalize(
          path.posix.join(path.posix.dirname(file.relativePath), specifier),
        ),
      );
    }
  }
  return paths;
}

function getPathVariants(importPath: string): string[] {
  const extension = path.posix.extname(importPath).toLowerCase();
  if (extension) {
    const extensionless = importPath.slice(0, -extension.length);
    const relatedExtensions =
      extension === ".js" ? [".ts", ".tsx", ".js", ".jsx"] :
      extension === ".mjs" ? [".mts", ".mjs", ".ts", ".js"] :
      extension === ".cjs" ? [".cts", ".cjs", ".ts", ".js"] :
      [extension];
    return [importPath, ...relatedExtensions.map((candidate) => `${extensionless}${candidate}`)];
  }

  return [
    importPath,
    ...SOURCE_EXTENSIONS.map((candidate) => `${importPath}${candidate}`),
    ...SOURCE_EXTENSIONS.map((candidate) => `${importPath}/index${candidate}`),
  ];
}

function getDirectNeighbors(
  files: FileCandidate[],
  changedPaths: Set<string>,
): Map<string, Set<string>> {
  const filePaths = new Set(files.map((file) => file.relativePath));
  const neighbors = new Map<string, Set<string>>();

  for (const file of files) {
    for (const importPath of getImportPaths(file)) {
      const relatedPath = getPathVariants(importPath).find((candidate) =>
        filePaths.has(candidate),
      );
      if (!relatedPath) {
        continue;
      }

      if (changedPaths.has(file.relativePath)) {
        const changes = neighbors.get(relatedPath) ?? new Set<string>();
        changes.add(file.relativePath);
        neighbors.set(relatedPath, changes);
      }
      if (changedPaths.has(relatedPath)) {
        const changes = neighbors.get(file.relativePath) ?? new Set<string>();
        changes.add(relatedPath);
        neighbors.set(file.relativePath, changes);
      }
    }
  }

  return neighbors;
}

export function rankFiles(files: FileCandidate[], options: RankOptions = {}): RankedFile[] {
  const taskWords = getTaskWords(options.task);
  const changedPaths = new Set(
    files.filter((file) => file.changed).map((file) => file.relativePath),
  );
  const diffFocus = Boolean(options.diff && changedPaths.size > 0);
  const neighbors = diffFocus ? getDirectNeighbors(files, changedPaths) : new Map();

  return files
    .map((file): RankedFile | undefined => {
      const taskMatch = getTaskMatch(file, taskWords);
      const relatedChanges = neighbors.get(file.relativePath) ?? new Set<string>();
      const isNeighbor = relatedChanges.size > 0;
      const structuralScore = getStructuralScore(file);
      const reasons = [...taskMatch.reasons];

      for (const category of file.categories) {
        if (category !== "source" && category !== "documentation") {
          reasons.push(`Recognized as ${category}`);
        }
      }
      if (file.changed) {
        reasons.push("Changed in the current Git worktree");
      }
      for (const changedPath of relatedChanges) {
        reasons.push(`Directly related to changed file "${changedPath}"`);
      }

      if (taskWords.length > 0) {
        if (taskMatch.score === 0 && !(diffFocus && (file.changed || isNeighbor))) {
          return undefined;
        }
        if (file.changed && taskMatch.score > 0) {
          reasons.push("Git change provides a secondary relevance boost");
        }

        return {
          ...file,
          score:
            taskMatch.score * 100 +
            (file.changed ? 10 : 0) +
            (isNeighbor ? 5 : 0) +
            structuralScore,
          reasons,
        };
      }

      if (diffFocus) {
        if (!file.changed && !isNeighbor) {
          return undefined;
        }
        return {
          ...file,
          score: (file.changed ? 10 : 0) + (isNeighbor ? 5 : 0) + structuralScore,
          reasons,
        };
      }

      const score =
        structuralScore +
        (file.categories.includes("source") ? 1 : 0) +
        (file.changed ? 10 : 0);
      if (score < 2) {
        return undefined;
      }
      return { ...file, score, reasons };
    })
    .filter((file): file is RankedFile => file !== undefined)
    .sort(
      (left, right) =>
        right.score - left.score || left.relativePath.localeCompare(right.relativePath),
    );
}
