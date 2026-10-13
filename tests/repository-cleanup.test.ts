import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  existsSync,
  symlinkSync,
  rmSync,
} from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { cleanWorkspace } from "../scripts/clean-workspace.mjs";
import { storagePaths } from "../scripts/storage-config.mjs";
import { hashPassword, verifyPassword } from "../server/security/passwords.ts";

test("generated-output cleanup preserves application data, credentials, dependencies and linked external files", () => {
  const root = mkdtempSync(path.join(tmpdir(), "dmct-clean-"));
  try {
    for (const name of [
      "data",
      "node_modules",
      "source",
      "outside",
      "dist",
      "coverage",
      "test-results",
      "playwright-report",
    ])
      mkdirSync(path.join(root, name));
    for (const name of [
      ".env.local",
      "data/live.sqlite",
      "node_modules/installed",
      "source/app.ts",
      "outside/keep",
      "dist/server.js",
      "tsconfig.tsbuildinfo",
      "next-env.d.ts",
    ])
      writeFileSync(path.join(root, name), "preserve-or-rebuild");
    symlinkSync(path.join(root, "outside"), path.join(root, ".next"));
    cleanWorkspace(root);
    cleanWorkspace(root);
    for (const name of [
      ".env.local",
      "data/live.sqlite",
      "node_modules/installed",
      "source/app.ts",
      "outside/keep",
    ])
      assert.equal(
        readFileSync(path.join(root, name), "utf8"),
        "preserve-or-rebuild",
      );
    for (const name of [
      ".next",
      "dist",
      "coverage",
      "test-results",
      "playwright-report",
      "tsconfig.tsbuildinfo",
      "next-env.d.ts",
    ])
      assert.equal(existsSync(path.join(root, name)), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("server and packaged operational scripts share storage defaults and custom path resolution", () => {
  const root = path.resolve("/tmp/dmct-config");
  assert.deepEqual(storagePaths({}, root), {
    database: root + "/data/dm-command-table.sqlite",
    uploads: root + "/data/uploads",
    backups: root + "/data/backups",
  });
  assert.deepEqual(
    storagePaths({ DM_COMMAND_TABLE_DB_PATH: "custom/app.sqlite" }, root),
    {
      database: root + "/custom/app.sqlite",
      uploads: root + "/custom/uploads",
      backups: root + "/custom/backups",
    },
  );
  assert.deepEqual(
    storagePaths(
      {
        DM_COMMAND_TABLE_DB_PATH: "",
        DM_COMMAND_TABLE_UPLOAD_PATH: "images",
        DM_COMMAND_TABLE_BACKUP_PATH: "/tmp/offline-backups",
      },
      root,
    ),
    {
      database: root + "/data/dm-command-table.sqlite",
      uploads: root + "/images",
      backups: "/tmp/offline-backups",
    },
  );
});

test("v11 passwords verify without accepting obsolete or malformed credential formats", async () => {
  const encoded = await hashPassword("current-password");
  assert.equal(await verifyPassword("current-password", encoded), true);
  assert.equal(await verifyPassword("wrong-password", encoded), false);
  assert.equal(
    await verifyPassword(
      "current-password",
      encoded.replace("scrypt-v1$", "scrypt$"),
    ),
    false,
  );
  assert.equal(
    await verifyPassword("current-password", encoded + "$extra"),
    false,
  );
});
