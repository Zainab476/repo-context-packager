import { execFile } from "node:child_process";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import {
  type FileCandidate,
  type FileCategory,
  type ScanResult,
} from "./types.js";

const EXCLUDED_DIRECTORIES = new Set([
  ".git",
  "node_modules",
  "dist",
  "dist-test",
  "build",
  "coverage",
  ".next",
  ".nuxt",
  ".cache",
  ".turbo",
  ".venv",
  "venv",
  "__pycache__",
  "vendor",
]);

const LOCKFILES = new Set([
  "bun.lock",
  "bun.lockb",
  "cargo.lock",
  "composer.lock",
  "gemfile.lock",
  "go.sum",
  "package-lock.json",
  "pnpm-lock.yaml",
  "poetry.lock",
  "yarn.lock",
]);

const BINARY_EXTENSIONS = new Set([
  ".7z",
  ".avif",
  ".bmp",
  ".class",
  ".dll",
  ".dylib",
  ".eot",
  ".exe",
  ".gif",
  ".ico",
  ".jpeg",
  ".jpg",
  ".mp3",
  ".mp4",
  ".otf",
  ".pdf",
  ".png",
  ".so",
  ".ttf",
  ".wasm",
  ".webp",
  ".woff",
  ".woff2",
  ".zip",
]);

const SENSITIVE_NAMES = new Set([
  "credentials.json",
  "id_rsa",
  "id_ed25519",
  "service-account.json",
]);

const MAX_FILE_SIZE_BYTES = 256 * 1024;

interface GitStatus {
  available: boolean;
  changedPaths: string[];
  warning?: string;
}

function isExcludedFile(relativePath: string, name: string): boolean {
  const lowerName = name.toLowerCase();
  const lowerPath = relativePath.toLowerCase();
  const extension = path.extname(lowerName);

  if (LOCKFILES.has(lowerName) || BINARY_EXTENSIONS.has(extension)) {
    return true;
  }

  if (lowerName === ".env" || (lowerName.startsWith(".env.") && lowerName !== ".env.example")) {
    return true;
  }

  if (SENSITIVE_NAMES.has(lowerName) || [".key", ".pem", ".p12", ".pfx"].includes(extension)) {
    return true;
  }

  return (
    lowerPath === ".context-pack.md" ||
    lowerPath === ".context-pack.json" ||
    lowerPath === "devpost/learner-profile.md"
  );
}

function getCategories(relativePath: string, extension: string): FileCategory[] {
  const normalized = relativePath.toLowerCase();
  const name = path.posix.basename(normalized);
  const pathParts = normalized.split("/");
  const categories: FileCategory[] = [];

  if (/^(index|main|cli|app|server)\.[^.]+$/.test(name)) {
    categories.push("entrypoint");
  }
  if (
    normalized.includes("schema") ||
    normalized.includes("model") ||
    normalized.includes("entity") ||
    extension === ".prisma" ||
    extension === ".sql"
  ) {
    categories.push("schema");
  }
  if (
    normalized.includes("route") ||
    normalized.includes("controller") ||
    pathParts.includes("api")
  ) {
    categories.push("route");
  }
  if (
    [
      "package.json",
      "tsconfig.json",
      "vite.config.js",
      "vite.config.ts",
      "webpack.config.js",
      "webpack.config.ts",
    ].includes(name) ||
    pathParts.includes("config")
  ) {
    categories.push("config");
  }
  if (
    /(^|\/)(test|tests|__tests__)\//.test(normalized) ||
    /\.(test|spec)\.[^.]+$/.test(name)
  ) {
    categories.push("test");
  }
  if (
    [
      ".cjs",
      ".cs",
      ".go",
      ".java",
      ".js",
      ".jsx",
      ".mjs",
      ".php",
      ".py",
      ".rb",
      ".rs",
      ".ts",
      ".tsx",
      ".vue",
    ].includes(extension)
  ) {
    categories.push("source");
  }
  if ([".md", ".mdx", ".rst", ".txt"].includes(extension)) {
    categories.push("documentation");
  }

  return categories;
}

async function collectFiles(root: string): Promise<{
  files: FileCandidate[];
  excludedCount: number;
}> {
  const files: FileCandidate[] = [];
  let excludedCount = 0;

  async function visit(directory: string): Promise<void> {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));

    for (const entry of entries) {
      const absolutePath = path.join(directory, entry.name);
      const relativePath = path.relative(root, absolutePath).split(path.sep).join("/");

      if (entry.isSymbolicLink()) {
        excludedCount += 1;
        continue;
      }

      if (entry.isDirectory()) {
        if (EXCLUDED_DIRECTORIES.has(entry.name.toLowerCase())) {
          excludedCount += 1;
          continue;
        }
        await visit(absolutePath);
        continue;
      }

      if (!entry.isFile() || isExcludedFile(relativePath, entry.name)) {
        excludedCount += 1;
        continue;
      }

      const fileStat = await stat(absolutePath);
      if (fileStat.size > MAX_FILE_SIZE_BYTES) {
        excludedCount += 1;
        continue;
      }

      const buffer = await readFile(absolutePath);
      if (buffer.includes(0)) {
        excludedCount += 1;
        continue;
      }

      const extension = path.extname(entry.name).toLowerCase();
      files.push({
        absolutePath,
        relativePath,
        name: entry.name,
        extension,
        content: buffer.toString("utf8"),
        sizeBytes: fileStat.size,
        categories: getCategories(relativePath, extension),
        changed: false,
      });
    }
  }

  await visit(root);
  return { files, excludedCount };
}

function parseChangedPaths(status: string): string[] {
  const records = status.split("\0");
  const changedPaths = new Set<string>();

  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    if (!record || record.length < 4) {
      continue;
    }

    const statusCode = record.slice(0, 2);
    const filePath = record.slice(3).replace(/\\/g, "/");
    if (filePath) {
      changedPaths.add(filePath);
    }

    if (statusCode.includes("R") || statusCode.includes("C")) {
      index += 1;
    }
  }

  return [...changedPaths];
}

async function getGitStatus(root: string): Promise<GitStatus> {
  return await new Promise((resolve) => {
    execFile(
      "git",
      ["status", "--short", "--untracked-files=all", "-z"],
      {
        cwd: root,
        encoding: "utf8",
        maxBuffer: 4 * 1024 * 1024,
        windowsHide: true,
      },
      (error, stdout) => {
        if (error) {
          const errorCode =
            error instanceof Error && "code" in error ? error.code : undefined;
          const reason =
            errorCode === "ENOENT"
              ? "Git is not available on PATH"
              : typeof errorCode === "number"
                ? `Git status exited with code ${errorCode}`
                : "Git status could not be read";
          resolve({
            available: false,
            changedPaths: [],
            warning: `Git status unavailable (${reason}); proceeding without Git-based ranking.`,
          });
          return;
        }

        resolve({
          available: true,
          changedPaths: parseChangedPaths(stdout),
        });
      },
    );
  });
}

function detectProjectHints(files: FileCandidate[], warnings: string[]): string[] {
  const hints = new Set<string>();
  const packageFile = files.find((file) => file.relativePath === "package.json");
  const hasTsConfig = files.some((file) => file.name.toLowerCase() === "tsconfig.json");

  if (packageFile) {
    hints.add("Node.js");
    try {
      const manifest: unknown = JSON.parse(packageFile.content);
      if (typeof manifest === "object" && manifest !== null) {
        const values = manifest as Record<string, unknown>;
        const dependencies = {
          ...(typeof values.dependencies === "object" && values.dependencies !== null
            ? values.dependencies
            : {}),
          ...(typeof values.devDependencies === "object" && values.devDependencies !== null
            ? values.devDependencies
            : {}),
        };
        if ("express" in dependencies) {
          hints.add("Express");
        }
        if ("typescript" in dependencies) {
          hints.add("TypeScript");
        }
      }
    } catch (error) {
      warnings.push(
        `Could not detect project hints from package.json: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  if (hasTsConfig) {
    hints.add("TypeScript");
  }

  return [...hints];
}

export async function scanRepository(targetPath: string): Promise<ScanResult> {
  const root = path.resolve(targetPath);
  const targetStat = await stat(root);
  if (!targetStat.isDirectory()) {
    throw new Error(`Target is not a directory: ${root}`);
  }

  const { files, excludedCount } = await collectFiles(root);
  const warnings: string[] = [];
  const gitStatus = await getGitStatus(root);

  if (gitStatus.warning) {
    warnings.push(gitStatus.warning);
  }
  const changedPathSet = new Set(gitStatus.changedPaths);
  for (const file of files) {
    file.changed = changedPathSet.has(file.relativePath);
  }

  return {
    root,
    files,
    scannedCount: files.length,
    excludedCount,
    gitAvailable: gitStatus.available,
    changedPaths: gitStatus.changedPaths,
    projectHints: detectProjectHints(files, warnings),
    warnings,
  };
}
