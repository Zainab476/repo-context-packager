import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
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
  assert.equal(result.gitAvailable, false);
  assert.ok(result.warnings.some((warning) => warning.includes("Git status unavailable")));
});

test("collects tracked and untracked Git changes and marks scanned files", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "context-pack-git-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, "src"));
  const trackedPath = path.join(root, "src", "auth.ts");
  await writeFile(trackedPath, "export const auth = false;\n");

  const git = (args: string[]) =>
    execFileSync("git", args, { cwd: root, stdio: "ignore" });
  git(["init", "--quiet"]);
  git(["config", "user.name", "Context Pack Test"]);
  git(["config", "user.email", "context-pack-test@example.invalid"]);
  git(["add", "--all"]);
  git(["commit", "--quiet", "-m", "baseline"]);

  const cleanResult = await scanRepository(root);
  assert.equal(cleanResult.gitAvailable, true);
  assert.deepEqual(cleanResult.changedPaths, []);

  await writeFile(trackedPath, "export const auth = true;\n");
  await writeFile(path.join(root, "src", "new-file.ts"), "export const fresh = true;\n");

  const result = await scanRepository(root);

  assert.equal(result.gitAvailable, true);
  assert.deepEqual([...result.changedPaths].sort(), ["src/auth.ts", "src/new-file.ts"]);
  assert.deepEqual(
    result.files.filter((file) => file.changed).map((file) => file.relativePath).sort(),
    ["src/auth.ts", "src/new-file.ts"],
  );
});

test("rejects a file path as a scan target", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "context-pack-target-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const filePath = path.join(root, "file.txt");
  await writeFile(filePath, "not a directory\n");

  await assert.rejects(scanRepository(filePath), /Target is not a directory/);
});
