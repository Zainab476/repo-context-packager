import assert from "node:assert/strict";
import test from "node:test";
import { formatJson, formatMarkdown } from "../src/formatters.js";
import { packageContext } from "../src/packager.js";
import type { RankedFile } from "../src/types.js";

const metadata = {
  projectName: "sample-project",
  task: "update authentication",
  scannedCount: 4,
  excludedCount: 1,
  gitAvailable: true,
  changedCount: 1,
  projectHints: ["Node.js"],
};

function rankedFile(relativePath: string, score: number, content: string): RankedFile {
  return {
    absolutePath: `C:\\sample-project\\${relativePath}`,
    relativePath,
    name: relativePath.split("/").at(-1) ?? relativePath,
    extension: ".ts",
    content,
    sizeBytes: content.length,
    categories: ["source"],
    changed: false,
    score,
    reasons: ["Task term matches the path"],
  };
}

test("estimates the serialized package and emits structured JSON", () => {
  const context = packageContext(
    metadata,
    [rankedFile("src/auth.ts", 20, "export const auth = true;\n")],
    { format: "json" },
  );
  const json = formatJson(context);
  const parsed = JSON.parse(json) as {
    estimatedTokens: number;
    files: Array<{ path: string; content: string }>;
  };

  assert.equal(context.estimatedTokens, Math.ceil(json.length / 4));
  assert.equal(parsed.estimatedTokens, context.estimatedTokens);
  assert.deepEqual(parsed.files[0], {
    path: "src/auth.ts",
    categories: ["source"],
    score: 20,
    reasons: ["Task term matches the path"],
    content: "export const auth = true;\n",
  });
});

test("token caps omit whole lower-ranked files and report why", () => {
  const selected = rankedFile("src/auth.ts", 20, "export const auth = true;\n");
  const omitted = rankedFile("src/unrelated.ts", 10, "x".repeat(6000));
  const oneFilePackage = packageContext(metadata, [selected], { format: "markdown" });
  const maxTokens = oneFilePackage.estimatedTokens + 100;
  const capped = packageContext(metadata, [selected, omitted], {
    format: "markdown",
    maxTokens,
  });
  const markdown = formatMarkdown(capped);

  assert.deepEqual(capped.files.map((file) => file.relativePath), ["src/auth.ts"]);
  assert.equal(capped.files[0]?.content, selected.content);
  assert.deepEqual(capped.omittedFiles, [
    {
      path: "src/unrelated.ts",
      score: 10,
      reason: "Omitted to stay within the --max-tokens budget.",
    },
  ]);
  assert.ok(capped.estimatedTokens <= maxTokens);
  assert.ok(markdown.includes("src/unrelated.ts"));
  assert.ok(!markdown.includes("x".repeat(100)));
});

test("without a token cap, all ranked files remain included", () => {
  const files = [
    rankedFile("src/auth.ts", 20, "auth\n"),
    rankedFile("src/session.ts", 10, "session\n"),
  ];

  const context = packageContext(metadata, files, { format: "markdown" });

  assert.deepEqual(
    context.files.map((file) => file.relativePath),
    ["src/auth.ts", "src/session.ts"],
  );
  assert.deepEqual(context.omittedFiles, []);
});
