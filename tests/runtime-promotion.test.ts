import assert from "node:assert/strict";
import test from "node:test";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  symlinkSync,
  readlinkSync,
  lstatSync,
  readdirSync,
  rmSync,
  linkSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { promoteRuntime } from "../deploy/debian-13/promote-runtime.mjs";

function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), "dmct-promotion-"));
  const source = path.join(root, "source"),
    dest = path.join(root, "dest");
  mkdirSync(source, { mode: 0o700 });
  mkdirSync(dest, { mode: 0o700 });
  return { root, source, dest };
}

test("promotion preserves normal runtime bytes and internal dependency links without copying ownership/hardlinks/privileged bits", () => {
  const { root, source, dest } = fixture();
  try {
    mkdirSync(source + "/node_modules/.pnpm/next", { recursive: true });
    writeFileSync(
      source + "/node_modules/.pnpm/next/index.js",
      "module.exports=1",
    );
    symlinkSync(".pnpm/next", source + "/node_modules/next");
    writeFileSync(source + "/server.js", "// candidate", { mode: 0o755 });
    linkSync(source + "/server.js", source + "/same.js");
    promoteRuntime(source, dest, process.getuid!());
    assert.equal(readFileSync(dest + "/server.js", "utf8"), "// candidate");
    assert.equal(readlinkSync(dest + "/node_modules/next"), ".pnpm/next");
    assert.equal(lstatSync(dest).mode & 0o777, 0o700);
    assert.equal(lstatSync(dest + "/server.js").mode & 0o777, 0o700);
    assert.notEqual(
      lstatSync(dest + "/same.js").ino,
      lstatSync(dest + "/server.js").ino,
    );
    assert.equal(lstatSync(dest + "/server.js").uid, process.getuid!());
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("promotion rejects a symlink candidate root before reading or copying a simulated protected directory", () => {
  const { root, source, dest } = fixture();
  try {
    const secret = root + "/secret";
    mkdirSync(secret, { mode: 0o700 });
    writeFileSync(secret + "/private", "private fixture data", { mode: 0o600 });
    symlinkSync(secret, source + "/candidate");
    assert.throws(() =>
      promoteRuntime(source + "/candidate", dest, process.getuid!()),
    );
    assert.deepEqual(readdirSync(dest), []);
    assert.equal(lstatSync(dest).mode & 0o777, 0o700);
    assert.equal(lstatSync(secret + "/private").mode & 0o777, 0o600);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("promotion rejects escaping links, special files, wrong inode ownership and non-private destinations", () => {
  for (const mode of ["absolute", "relative", "fifo", "owner"]) {
    const { root, source, dest } = fixture();
    try {
      if (mode === "absolute") symlinkSync(root, source + "/escape");
      if (mode === "relative") symlinkSync("../outside", source + "/escape");
      if (mode === "fifo")
        assert.equal(spawnSync("mkfifo", [source + "/pipe"]).status, 0);
      assert.throws(() =>
        promoteRuntime(
          source,
          dest,
          process.getuid!() + (mode === "owner" ? 1 : 0),
        ),
      );
      assert.equal(lstatSync(dest).mode & 0o777, 0o700);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }
  const { root, source, dest } = fixture();
  try {
    writeFileSync(dest + "/existing", "keep");
    assert.throws(() => promoteRuntime(source, dest, process.getuid!()));
    assert.equal(readFileSync(dest + "/existing", "utf8"), "keep");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
