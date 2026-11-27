import {
  copyFileSync,
  openSync,
  readSync,
  closeSync,
  existsSync,
  mkdirSync,
  readFileSync,
  chmodSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createHash } from "node:crypto";
function checksum(filename, buffer) {
  const hash = createHash("sha256"),
    handle = openSync(filename, "r");
  try {
    let bytes;
    while ((bytes = readSync(handle, buffer, 0, buffer.length, null)) > 0)
      hash.update(buffer.subarray(0, bytes));
    return hash.digest("hex");
  } finally {
    closeSync(handle);
  }
}

import path from "node:path";
import { DatabaseSync } from "node:sqlite";

export function verifyBackup(directory) {
  const manifest = JSON.parse(
    readFileSync(path.join(directory, "manifest.json"), "utf8"),
  );
  const buffer = Buffer.allocUnsafe(64 * 1024);
  if (manifest.format !== "dmct-local-backup" || manifest.version !== 1)
    throw new Error("Unsupported backup format");
  if (
    checksum(path.join(directory, "dm-command-table.sqlite"), buffer) !==
    manifest.databaseSha256
  )
    throw new Error("Backup database checksum mismatch");
  const database = new DatabaseSync(
    path.join(directory, "dm-command-table.sqlite"),
    { readOnly: true },
  );
  try {
    if (
      Object.values(database.prepare("PRAGMA quick_check").get())[0] !== "ok" ||
      database.prepare("PRAGMA foreign_key_check").get()
    )
      throw new Error("Backup database integrity check failed");
    const files = database
      .prepare("SELECT filename FROM screenshots")
      .all()
      .map(({ filename }) => filename);
    for (const filename of files) {
      if (
        !/^[0-9a-f-]+\.webp$/i.test(filename) ||
        !existsSync(path.join(directory, "uploads", filename))
      )
        throw new Error("Backup screenshot is missing or invalid");
      if (
        checksum(path.join(directory, "uploads", filename), buffer) !==
        manifest.screenshots?.[filename]
      )
        throw new Error("Backup screenshot checksum mismatch");
    }
    return {
      files,
      schemaVersion: database
        .prepare("SELECT MAX(version) AS version FROM schema_migrations")
        .get().version,
    };
  } finally {
    database.close();
  }
}

export function createLocalBackup({ databasePath, uploadPath, destination }) {
  const databaseFile = path.resolve(databasePath);
  const uploads = path.resolve(uploadPath);
  const target = path.resolve(destination);
  if (!existsSync(databaseFile))
    throw new Error("The live database does not exist");
  if (
    target === path.dirname(databaseFile) ||
    target === uploads ||
    target.startsWith(uploads + path.sep)
  )
    throw new Error(
      "Backup storage must be separate from live uploads and database",
    );
  mkdirSync(target, { recursive: false, mode: 0o700 });
  let lock, snapshot;
  let locked = false;
  try {
    lock = new DatabaseSync(databaseFile);
    lock.exec("PRAGMA busy_timeout=10000; BEGIN IMMEDIATE");
    locked = true;
    // A second connection reads the committed WAL snapshot while writes/deletions are held.
    snapshot = new DatabaseSync(databaseFile, { readOnly: true });
    const output = path.join(target, "dm-command-table.sqlite");
    snapshot.exec(`VACUUM INTO '${output.replaceAll("'", "''")}'`);
    chmodSync(output, 0o600);
    mkdirSync(path.join(target, "uploads"), { mode: 0o700 });
    const filenames = snapshot
      .prepare("SELECT filename FROM screenshots")
      .all();
    for (const { filename } of filenames) {
      if (!/^[0-9a-f-]+\.webp$/i.test(filename))
        throw new Error("Invalid screenshot filename");
      const dest = path.join(target, "uploads", filename);
      copyFileSync(path.join(uploads, filename), dest);
      chmodSync(dest, 0o600);
    }
    // The complete SQLite/media copy is fixed now. Hashing and verification use
    // only the private backup, so application writes need no longer be blocked.
    snapshot.close();
    snapshot = undefined;
    lock.exec("COMMIT");
    locked = false;
    lock.close();
    lock = undefined;
    const buffer = Buffer.allocUnsafe(64 * 1024);
    const screenshots = {};
    for (const { filename } of filenames)
      screenshots[filename] = checksum(
        path.join(target, "uploads", filename),
        buffer,
      );
    writeFileSync(
      path.join(target, "manifest.json"),
      JSON.stringify({
        format: "dmct-local-backup",
        version: 1,
        createdAt: new Date().toISOString(),
        screenshotCount: filenames.length,
        screenshots,
        databaseSha256: checksum(output, buffer),
      }) + "\n",
      { flag: "wx", mode: 0o600 },
    );
    verifyBackup(target);
    return target;
  } catch (error) {
    const errors = [error];
    try {
      if (locked) lock.exec("ROLLBACK");
    } catch (rollbackError) {
      errors.push(rollbackError);
    }
    try {
      rmSync(target, { recursive: true, force: true });
    } catch (cleanupError) {
      errors.push(cleanupError);
    }
    if (errors.length > 1)
      throw new AggregateError(
        errors,
        "Backup failed and cleanup was incomplete",
      );
    throw error;
  } finally {
    snapshot?.close();
    lock?.close();
  }
}

// Restore into an empty destination so no live database can be overwritten accidentally.
export function restoreLocalBackup(source, target) {
  const result = verifyBackup(source);
  if (existsSync(target))
    throw new Error("Restore destination must not already exist");
  mkdirSync(target, { mode: 0o700, recursive: false });
  try {
    copyFileSync(
      path.join(source, "dm-command-table.sqlite"),
      path.join(target, "dm-command-table.sqlite"),
    );
    chmodSync(path.join(target, "dm-command-table.sqlite"), 0o600);
    mkdirSync(path.join(target, "uploads"), { mode: 0o700 });
    for (const filename of result.files) {
      copyFileSync(
        path.join(source, "uploads", filename),
        path.join(target, "uploads", filename),
      );
      chmodSync(path.join(target, "uploads", filename), 0o600);
    }
  } catch (error) {
    rmSync(target, { recursive: true, force: true });
    throw error;
  }
  return result;
}

// Names written by backup-local.mjs: an ISO timestamp with ":" and "." replaced
// by "-", then a UUID. Only folders with this name and a manifest are pruned, so
// restored copies and anything placed here by hand are never touched.
const BACKUP_NAME =
  /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * Parses the number of automatic backups to keep. 0 keeps every backup.
 * @param {string | undefined} value
 */
export function backupRetention(value) {
  if (value === undefined || value === "") return 14;
  if (!/^\d{1,6}$/.test(value))
    throw new Error(
      "DM_COMMAND_TABLE_BACKUP_KEEP must be a whole number (0 keeps every backup).",
    );
  return Number(value);
}

/**
 * Removes the oldest automatic backups so that `keep` remain. The newest
 * backup (normally the one just created) is always kept.
 * @param {string} backupRoot
 * @param {number} keep
 * @returns {string[]} removed backup folders
 */
export function pruneLocalBackups(backupRoot, keep) {
  if (!keep) return [];
  const backups = readdirSync(backupRoot, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isDirectory() &&
        BACKUP_NAME.test(entry.name) &&
        existsSync(path.join(backupRoot, entry.name, "manifest.json")),
    )
    .map((entry) => entry.name)
    .sort()
    .reverse();
  const removed = [];
  for (const name of backups.slice(Math.max(keep, 1))) {
    const folder = path.join(backupRoot, name);
    rmSync(folder, { recursive: true, force: true });
    removed.push(folder);
  }
  return removed;
}
