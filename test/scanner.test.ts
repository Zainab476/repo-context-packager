import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { scanRepository } from "../src/scanner.js";

test("scans text files while excluding credentials, noise, and private learning context", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "context-pack-scan-"));
  t.after(() => rm(root, { recursive: true, force: true }));

  await mkdir(path.join(root, "src"));
  await mkdir(path.join(root, "node_modules", "example"), { recursive: true });
  await mkdir(path.join(root, "devpost"));
  await writeFile(
    path.join(root, "package.json"),
    JSON.stringify({ devDependencies: { express: "*", typescript: "*" } }),
  );
  await writeFile(path.join(root, "src", "auth.ts"), "export const auth = true;\n");
  await writeFile(path.join(root, ".env"), "TOKEN=private\n");
  await writeFile(path.join(root, ".env.example"), "TOKEN=\n");
  await writeFile(path.join(root, "package-lock.json"), "{}\n");
  await writeFile(path.join(root, "node_modules", "example", "index.js"), "ignored\n");
  await writeFile(path.join(root, "devpost", "learner-profile.md"), "private context\n");

  const result = await scanRepository(root);
  const paths = result.files.map((file) => file.relativePath);

  assert.deepEqual(paths, [".env.example", "package.json", "src/auth.ts"]);
  assert.equal(result.scannedCount, 3);
  assert.ok(result.excludedCount >= 4);
  assert.deepEqual(result.projectHints, ["Node.js", "Express", "TypeScript"]);
});

test("rejects a file path as a scan target", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "context-pack-target-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const filePath = path.join(root, "file.txt");
  await writeFile(filePath, "not a directory\n");

  await assert.rejects(scanRepository(filePath), /Target is not a directory/);
});
