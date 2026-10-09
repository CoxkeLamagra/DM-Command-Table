import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  currentSchemaVersion,
  expectedSchemaVersion,
  openDatabase,
} from "../db/sqlite.ts";

test("current database bootstrap configures and verifies a persistent SQLite file", () => {
  const root = mkdtempSync(path.join(tmpdir(), "dmct-"));
  try {
    const database = openDatabase(
      path.join(root, "data", "dm-command-table.sqlite"),
    );
    assert.equal(currentSchemaVersion(database), expectedSchemaVersion());
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
