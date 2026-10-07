import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  chmodSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createHash } from "node:crypto";
function checksum(filename) {
  return createHash("sha256").update(readFileSync(filename)).digest("hex");
}

import path from "node:path";
import { DatabaseSync } from "node:sqlite";

export function verifyBackup(directory) {
  const manifest = JSON.parse(
    readFileSync(path.join(directory, "manifest.json"), "utf8"),
  );
  if (manifest.format !== "dmct-local-backup" || manifest.version !== 1)
    throw new Error("Unsupported backup format");
  if (
    checksum(path.join(directory, "dm-command-table-v6.sqlite")) !==
    manifest.databaseSha256
  )
    throw new Error("Backup database checksum mismatch");
  const database = new DatabaseSync(
    path.join(directory, "dm-command-table-v6.sqlite"),
    { readOnly: true },
  );
  try {
    if (
      Object.values(database.prepare("PRAGMA quick_check").get())[0] !== "ok" ||
      database.prepare("PRAGMA foreign_key_check").all().length
    )
      throw new Error("Backup database integrity check failed");
    const files = database
      .prepare("SELECT filename FROM screenshots")
      .all()
      .map(({ filename }) => filename);
    for (const filename of files) {
      if (
        checksum(path.join(directory, "uploads-v6", filename)) !==
        manifest.screenshots?.[filename]
      )
        throw new Error("Backup screenshot checksum mismatch");
      if (
        !/^[0-9a-f-]+\.webp$/i.test(filename) ||
        !existsSync(path.join(directory, "uploads-v6", filename))
      )
        throw new Error("Backup screenshot is missing or invalid");
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
  const lock = new DatabaseSync(databaseFile);
  let snapshot;
  try {
    lock.exec("PRAGMA busy_timeout=10000; BEGIN IMMEDIATE");
    // A second connection reads the committed WAL snapshot while writes/deletions are held.
    snapshot = new DatabaseSync(databaseFile, { readOnly: true });
    const output = path.join(target, "dm-command-table-v6.sqlite");
    snapshot.exec(`VACUUM INTO '${output.replaceAll("'", "''")}'`);
    chmodSync(output, 0o600);
    mkdirSync(path.join(target, "uploads-v6"), { mode: 0o700 });
    const filenames = snapshot
      .prepare("SELECT filename FROM screenshots")
      .all();
    const screenshots = {};
    for (const { filename } of filenames) {
      if (!/^[0-9a-f-]+\.webp$/i.test(filename))
        throw new Error("Invalid screenshot filename");
      const dest = path.join(target, "uploads-v6", filename);
      copyFileSync(path.join(uploads, filename), dest);
      chmodSync(dest, 0o600);
      screenshots[filename] = checksum(dest);
    }
    writeFileSync(
      path.join(target, "manifest.json"),
      JSON.stringify({
        format: "dmct-local-backup",
        version: 1,
        createdAt: new Date().toISOString(),
        screenshotCount: filenames.length,
        screenshots,
        databaseSha256: checksum(output),
      }) + "\n",
      { flag: "wx", mode: 0o600 },
    );
    verifyBackup(target);
    lock.exec("COMMIT");
    return target;
  } catch (error) {
    if (lock.isTransaction) lock.exec("ROLLBACK");
    rmSync(target, { recursive: true, force: true });
    throw error;
  } finally {
    snapshot?.close();
    lock.close();
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
      path.join(source, "dm-command-table-v6.sqlite"),
      path.join(target, "dm-command-table-v6.sqlite"),
    );
    chmodSync(path.join(target, "dm-command-table-v6.sqlite"), 0o600);
    mkdirSync(path.join(target, "uploads-v6"), { mode: 0o700 });
    for (const filename of result.files) {
      copyFileSync(
        path.join(source, "uploads-v6", filename),
        path.join(target, "uploads-v6", filename),
      );
      chmodSync(path.join(target, "uploads-v6", filename), 0o600);
    }
  } catch (error) {
    rmSync(target, { recursive: true, force: true });
    throw error;
  }
  return result;
}
