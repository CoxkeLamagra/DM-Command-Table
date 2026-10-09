import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  symlinkSync,
  readlinkSync,
  realpathSync,
  existsSync,
  readdirSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
const script = path.resolve("scripts/package-runtime.mjs");
function fixture() {
  const directory = mkdtempSync(path.join(tmpdir(), "dmct-runtime-package-"));
  for (const folder of [
    ".next/standalone/node_modules/.pnpm/next",
    ".next/static",
    "public",
    "scripts",
  ])
    mkdirSync(path.join(directory, folder), { recursive: true });
  writeFileSync(
    path.join(directory, ".next/standalone/server.js"),
    "console.log('server')",
  );
  writeFileSync(
    path.join(directory, ".next/standalone/node_modules/.pnpm/next/index.js"),
    "module.exports = 'next'",
  );
  for (const filename of [
    "backup-local.mjs",
    "check-local-storage.mjs",
    "local-backup.mjs",
    "maintenance.mjs",
    "restore-local.mjs",
    "browser-test-server.mjs",
    "package-runtime.mjs",
  ])
    writeFileSync(path.join(directory, "scripts", filename), "// fixture");
  return directory;
}
test("runtime packages preserve relative dependencies and remain self-contained", () => {
  const directory = fixture();
  try {
    symlinkSync(
      ".pnpm/next",
      path.join(directory, ".next/standalone/node_modules/next"),
    );
    const destination = path.join(directory, "runtime");
    const result = spawnSync(process.execPath, [script, destination], {
      cwd: directory,
      encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(readdirSync(path.join(destination, "scripts")).sort(), [
      "backup-local.mjs",
      "check-local-storage.mjs",
      "local-backup.mjs",
      "maintenance.mjs",
      "restore-local.mjs",
    ]);
    const dependency = path.join(destination, "node_modules/next");
    assert.equal(readlinkSync(dependency), ".pnpm/next");
    assert.ok(realpathSync(dependency).startsWith(destination + path.sep));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
test("runtime packaging refuses dependency links outside the release", () => {
  const directory = fixture();
  try {
    symlinkSync(
      path.join(directory, ".next/standalone/node_modules/.pnpm/next"),
      path.join(directory, ".next/standalone/node_modules/next"),
    );
    const destination = path.join(directory, "runtime");
    const result = spawnSync(process.execPath, [script, destination], {
      cwd: directory,
      encoding: "utf8",
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /escapes the package/);
    assert.equal(existsSync(destination), false);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
