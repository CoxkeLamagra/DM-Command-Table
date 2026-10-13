import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  symlinkSync,
  rmSync,
  unlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  writeRuntimeManifest,
  verifyRuntime,
  assertTrustedStaging,
} from "../scripts/runtime-integrity.mjs";

test("offline runtime verification rejects changed, added, missing and escaping files", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "dmct-integrity-"));
  try {
    mkdirSync(path.join(directory, "scripts"));
    for (const filename of [
      "server.js",
      "scripts/backup-local.mjs",
      "scripts/restore-local.mjs",
    ])
      writeFileSync(path.join(directory, filename), "// approved code");
    symlinkSync("server.js", path.join(directory, "internal-link"));
    writeRuntimeManifest(directory, "11.0.0");
    assert.equal(verifyRuntime(directory).applicationVersion, "11.0.0");
    writeFileSync(path.join(directory, "server.js"), "// corrupt transfer");
    assert.throws(() => verifyRuntime(directory), /checksum/);
    writeFileSync(path.join(directory, "server.js"), "// approved code");
    writeFileSync(path.join(directory, "unexpected.js"), "// unexpected");
    assert.throws(() => verifyRuntime(directory), /inventory/);
    unlinkSync(path.join(directory, "unexpected.js"));
    symlinkSync("/etc/hosts", path.join(directory, "outside"));
    assert.throws(() => verifyRuntime(directory), /escapes/);
    unlinkSync(path.join(directory, "outside"));
    unlinkSync(path.join(directory, "scripts/restore-local.mjs"));
    assert.throws(() => verifyRuntime(directory), /Incomplete/);
    // A user-writable package must never be accepted as root-approved staging.
    assert.throws(() => assertTrustedStaging(directory), /root-owned/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
