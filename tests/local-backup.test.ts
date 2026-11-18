import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { spawnSync } from "node:child_process";
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

test("backup holds writers only through the copy and remains valid after live files change during hashing", () => {
  const root = mkdtempSync(path.join(tmpdir(), "dmct-backup-lock-"));
  const databasePath = path.join(root, "live.sqlite"),
    uploadPath = path.join(root, "uploads"),
    destination = path.join(root, "backup");
  mkdirSync(uploadPath);
  const db = new DatabaseSync(databasePath);
  db.exec("PRAGMA journal_mode=WAL");
  runMigrations(db);
  db.exec(
    "INSERT INTO users(id,display_name,username,password_hash,is_admin,created_at,updated_at) VALUES('owner','Original','owner','hash',1,1,1)",
  );
  const id = crypto.randomUUID(),
    filename = id + ".webp",
    source = path.join(uploadPath, filename);
  writeFileSync(source, "original image");
  db.prepare(
    "INSERT INTO screenshots(id,filename,original_name,mime_type,size,uploaded_by,created_at) VALUES(?,?,?,'image/webp',14,'owner',1)",
  ).run(id, filename, filename);
  const originalOpen = fs.openSync,
    originalCopy = fs.copyFileSync;
  let lockedDuringCopy = false,
    changedDuringHash = false;
  fs.copyFileSync = (from, to, mode) => {
    if (String(from) === source) {
      assert.throws(() => db.exec("BEGIN IMMEDIATE"), /locked/);
      lockedDuringCopy = true;
    }
    return originalCopy(from, to, mode);
  };
  fs.openSync = (file, flags, mode) => {
    if (
      String(file) === path.join(destination, "uploads", filename) &&
      !changedDuringHash
    ) {
      db.exec(
        "BEGIN IMMEDIATE; UPDATE users SET display_name='Changed' WHERE id='owner'; COMMIT",
      );
      rmSync(source);
      changedDuringHash = true;
    }
    return originalOpen(file, flags, mode);
  };
  syncBuiltinESMExports();
  try {
    createLocalBackup({ databasePath, uploadPath, destination });
    assert.equal(lockedDuringCopy, true);
    assert.equal(changedDuringHash, true);
    assert.deepEqual(verifyBackup(destination).files, [filename]);
    assert.equal(
      readFileSync(path.join(destination, "uploads", filename), "utf8"),
      "original image",
    );
    const copied = new DatabaseSync(
      path.join(destination, "dm-command-table.sqlite"),
      { readOnly: true },
    );
    try {
      assert.equal(
        copied.prepare("SELECT display_name FROM users").get()?.display_name,
        "Original",
      );
    } finally {
      copied.close();
    }
    assert.equal(
      db.prepare("SELECT display_name FROM users").get()?.display_name,
      "Changed",
    );
  } finally {
    fs.openSync = originalOpen;
    fs.copyFileSync = originalCopy;
    syncBuiltinESMExports();
    db.close();
    rmSync(root, { recursive: true, force: true });
  }
});

test("backup removes its partial destination if opening the source database fails", () => {
  const root = mkdtempSync(path.join(tmpdir(), "dmct-backup-open-"));
  try {
    const databasePath = path.join(root, "not-a-database"),
      destination = path.join(root, "backup");
    mkdirSync(databasePath);
    assert.throws(() =>
      createLocalBackup({
        databasePath,
        uploadPath: path.join(root, "uploads"),
        destination,
      }),
    );
    assert.equal(existsSync(destination), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("storage CLI reports foreign-key corruption even when SQLite quick_check passes", () => {
  const root = mkdtempSync(path.join(tmpdir(), "dmct-storage-fk-"));
  try {
    const databasePath = path.join(root, "data.sqlite"),
      uploads = path.join(root, "uploads");
    mkdirSync(uploads);
    const db = new DatabaseSync(databasePath);
    runMigrations(db);
    db.exec(
      "PRAGMA foreign_keys=OFF; INSERT INTO story_session_links VALUES('missing-story','missing-session')",
    );
    assert.equal(
      Object.values(db.prepare("PRAGMA quick_check").get()!)[0],
      "ok",
    );
    db.close();
    const result = spawnSync(
      process.execPath,
      ["scripts/check-local-storage.mjs"],
      {
        cwd: process.cwd(),
        encoding: "utf8",
        env: {
          ...process.env,
          DM_COMMAND_TABLE_DB_PATH: databasePath,
          DM_COMMAND_TABLE_UPLOAD_PATH: uploads,
        },
      },
    );
    assert.equal(result.status, 1);
    assert.match(result.stderr, /SQLite foreign-key check failed/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
