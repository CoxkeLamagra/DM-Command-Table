import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  currentV6SchemaVersion,
  expectedV6SchemaVersion,
  openV6Database,
} from "../db/v6-sqlite.ts";

test("v6 database bootstrap configures and verifies a persistent SQLite file", () => {
  const root = mkdtempSync(path.join(tmpdir(), "dmct-v6-"));
  try {
    const database = openV6Database(path.join(root, "data", "v6.sqlite"));
    assert.equal(currentV6SchemaVersion(database), expectedV6SchemaVersion());
    assert.equal(
      (
        database.prepare("PRAGMA foreign_keys").get() as {
          foreign_keys: number;
        }
      ).foreign_keys,
      1,
    );
    assert.equal(
      (
        database.prepare("PRAGMA journal_mode").get() as {
          journal_mode: string;
        }
      ).journal_mode,
      "wal",
    );
    database.close();
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
