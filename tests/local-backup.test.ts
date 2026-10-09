import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
  existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { runMigrations } from "../db/migrations.ts";
import {
  createLocalBackup,
  verifyBackup,
  restoreLocalBackup,
} from "../scripts/local-backup.mjs";

test("local backups include WAL data and recorded screenshots and restore into an empty destination", () => {
  const root = mkdtempSync(path.join(tmpdir(), "dmct-backup-test-"));
  const databasePath = path.join(root, "live.sqlite");
  const uploadPath = path.join(root, "uploads");
  mkdirSync(uploadPath);
  const db = new DatabaseSync(databasePath);
  db.exec("PRAGMA journal_mode=WAL");
  runMigrations(db);
  const now = Date.now();
  db.prepare(
    "INSERT INTO users(id,display_name,username,password_hash,is_admin,created_at,updated_at) VALUES('owner','Owner','owner','hash',1,?,?)",
  ).run(now, now);
  const id = crypto.randomUUID(),
    filename = id + ".webp";
  writeFileSync(path.join(uploadPath, filename), "image-bytes");
  db.prepare(
    "INSERT INTO screenshots(id,filename,original_name,mime_type,size,uploaded_by,created_at) VALUES(?,?,?,'image/webp',11,'owner',?)",
  ).run(id, filename, filename, now);
  try {
    const destination = path.join(root, "backup");
    createLocalBackup({ databasePath, uploadPath, destination });
    assert.deepEqual(verifyBackup(destination).files, [filename]);
    const restored = path.join(root, "restored");
    restoreLocalBackup(destination, restored);
    assert.equal(
      readFileSync(path.join(restored, "uploads", filename), "utf8"),
      "image-bytes",
    );
    assert.throws(
      () => restoreLocalBackup(destination, restored),
      /must not already exist/,
    );
    rmSync(path.join(uploadPath, filename));
    const failed = path.join(root, "failed");
    assert.throws(() =>
      createLocalBackup({ databasePath, uploadPath, destination: failed }),
    );
    assert.equal(existsSync(failed), false);
  } finally {
    db.close();
    rmSync(root, { recursive: true, force: true });
  }
});
