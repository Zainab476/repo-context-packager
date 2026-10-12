import assert from "node:assert/strict";
import test from "node:test";
import { rankFiles } from "../src/ranker.js";
import type { FileCandidate } from "../src/types.js";

function candidate(
  relativePath: string,
  content: string,
  categories: FileCandidate["categories"] = ["source"],
  changed = false,
): FileCandidate {
  return {
    absolutePath: `C:\\fixture\\${relativePath}`,
    relativePath,
    name: relativePath.split("/").at(-1) ?? relativePath,
    extension: ".ts",
    content,
    sizeBytes: content.length,
    categories,
    changed,
  };
}

test("task matches govern selection instead of structural-only signals", () => {
  const files = [
    candidate("src/auth.middleware.ts", "export function authMiddleware() {}"),
    candidate("src/schemas/user.ts", "export interface User {}", ["schema", "source"]),
    candidate("src/config/database.ts", "export const connection = 1;", ["config", "source"]),
  ];

  const ranked = rankFiles(files, { task: "add auth middleware" });

  assert.deepEqual(ranked.map((file) => file.relativePath), ["src/auth.middleware.ts"]);
  assert.ok(ranked[0]?.reasons.some((reason) => reason.includes('Task term "auth"')));
});

test("Git changes boost matching files without replacing task relevance", () => {
  const files = [
    candidate("src/auth-handler.ts", "export const auth = true;"),
    candidate("src/auth-service.ts", "export const auth = true;", ["source"], true),
  ];

  const ranked = rankFiles(files, { task: "auth" });

  assert.deepEqual(
    ranked.map((file) => file.relativePath),
    ["src/auth-service.ts", "src/auth-handler.ts"],
  );
  assert.ok(ranked[0]?.reasons.includes("Git change provides a secondary relevance boost"));
});

test("--diff includes changed files and direct imports, even without task matches", () => {
  const files = [
    candidate(
      "src/routes/session.ts",
      'import { isAuthenticated } from "../auth.middleware.js";',
      ["route", "source"],
      true,
    ),
    candidate("src/auth.middleware.ts", "export function isAuthenticated() {}"),
    candidate("src/schemas/session.ts", "export interface Session {}", ["schema", "source"]),
  ];

  const ranked = rankFiles(files, { task: "update billing", diff: true });

  assert.deepEqual(
    ranked.map((file) => file.relativePath).sort(),
    ["src/auth.middleware.ts", "src/routes/session.ts"],
  );
  assert.ok(
    ranked
      .find((file) => file.relativePath === "src/auth.middleware.ts")
      ?.reasons.some((reason) => reason.includes("Directly related to changed file")),
  );
});

test("keeps structural files and omits low-signal files without a task", () => {
  const files = [
    candidate("src/schemas/user.ts", "export interface User {}", ["schema", "source"]),
    candidate("src/misc.ts", "export const value = 1;", ["source"]),
    candidate("src/auth.test.ts", "import { auth } from './auth.js';", ["test", "source"]),
  ];

  const ranked = rankFiles(files);
  const cleanDiffRanked = rankFiles(files, { diff: true });

  assert.deepEqual(
    ranked.map((file) => file.relativePath),
    ["src/schemas/user.ts", "src/auth.test.ts"],
  );
  assert.deepEqual(
    cleanDiffRanked.map((file) => file.relativePath),
    ["src/schemas/user.ts", "src/auth.test.ts"],
  );
  assert.ok(ranked[0]?.reasons.includes("Recognized as schema"));
});
