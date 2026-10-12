import assert from "node:assert/strict";
import test from "node:test";
import { rankFiles } from "../src/ranker.js";
import type { FileCandidate } from "../src/types.js";

function candidate(
  relativePath: string,
  content: string,
  categories: FileCandidate["categories"] = ["source"],
): FileCandidate {
  return {
    absolutePath: `C:\\fixture\\${relativePath}`,
    relativePath,
    name: relativePath.split("/").at(-1) ?? relativePath,
    extension: ".ts",
    content,
    sizeBytes: content.length,
    categories,
    changed: false,
  };
}

test("ranks task-matching paths and file headers above unrelated source", () => {
  const files = [
    candidate("src/auth.middleware.ts", "export function authMiddleware() {}"),
    candidate("src/billing.ts", "export function calculateInvoice() {}"),
  ];

  const ranked = rankFiles(files, "add auth middleware");

  assert.equal(ranked[0]?.relativePath, "src/auth.middleware.ts");
  assert.ok(ranked[0]?.reasons.some((reason) => reason.includes('Task term "auth"')));
  assert.ok(ranked[0]?.score > (ranked[1]?.score ?? 0));
});

test("keeps structural files and omits low-signal files without a task", () => {
  const files = [
    candidate("src/schemas/user.ts", "export interface User {}", ["schema", "source"]),
    candidate("src/misc.ts", "export const value = 1;", ["source"]),
    candidate("src/auth.test.ts", "import { auth } from './auth.js';", ["test", "source"]),
  ];

  const ranked = rankFiles(files);

  assert.deepEqual(
    ranked.map((file) => file.relativePath),
    ["src/schemas/user.ts", "src/auth.test.ts"],
  );
  assert.ok(ranked[0]?.reasons.includes("Recognized as schema"));
});
