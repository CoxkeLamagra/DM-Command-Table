import {
  accessSync,
  mkdirSync,
  renameSync,
  readdirSync,
  statSync,
  existsSync,
} from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { storagePaths } from "./storage-config.mjs";
export function runMaintenance({ databasePath, uploads, now = Date.now() }) {
  // Maintenance must never create an empty database at a mistyped path.
  accessSync(databasePath);
  const quarantine = path.join(path.dirname(uploads), "media-quarantine");
  mkdirSync(uploads, { recursive: true, mode: 0o700 });
  const moved = [];
  const database = new DatabaseSync(databasePath);
  let locked = false;
  try {
    database.exec("PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000");
    database.exec("BEGIN IMMEDIATE");
    locked = true;
    const retainedByHistory = database.prepare(
      "SELECT 1 FROM combat_history WHERE before_state LIKE ? LIMIT 1",
    );
    const orphanRows = database
      .prepare(
        `SELECT s.id,s.filename FROM screenshots s
       WHERE (s.uploaded_by IS NULL OR (s.staging=1 AND s.created_at<?))
       AND NOT EXISTS (SELECT 1 FROM screenshot_references r WHERE r.screenshot_id=s.id)`,
      )
      .all(now - 24 * 60 * 60 * 1000)
      .filter((row) => !retainedByHistory.get("%" + row.id + "%"));
    const remove = database.prepare("DELETE FROM screenshots WHERE id=?");
    let quarantineReady = false;
    function quarantineFile(source, filename) {
      if (!quarantineReady) {
        mkdirSync(quarantine, { recursive: true, mode: 0o700 });
        quarantineReady = true;
      }
      const previous = path.join(quarantine, filename);
      const target = existsSync(previous)
        ? path.join(quarantine, crypto.randomUUID() + "-" + filename)
        : previous;
      renameSync(source, target);
      moved.push([source, target]);
    }
    // Removed accounts' unreferenced files are quarantined, never irreversibly purged.
    for (const row of orphanRows) {
      if (!/^[0-9a-f-]+\.webp$/i.test(row.filename))
        throw new Error("Invalid asset filename");
      const source = path.join(uploads, row.filename);
      if (existsSync(source)) {
        quarantineFile(source, row.filename);
      }
      remove.run(row.id);
    }
    const known = new Set();
    for (const { filename } of database
      .prepare("SELECT filename FROM screenshots")
      .iterate())
      known.add(filename);
    function oldFile(file) {
      try {
        return (
          now - statSync(path.join(uploads, file)).mtimeMs > 24 * 60 * 60 * 1000
        );
      } catch (error) {
        if (error.code === "ENOENT") return false;
        throw error;
      }
    }
    const orphanFiles = readdirSync(uploads).filter(
      (file) =>
        /^[0-9a-f-]+\.webp$/i.test(file) && !known.has(file) && oldFile(file),
    );
    for (const file of orphanFiles) {
      quarantineFile(path.join(uploads, file), file);
    }
    database.prepare("DELETE FROM local_sessions WHERE expires_at<=?").run(now);
    database
      .prepare("DELETE FROM security_rate_limits WHERE resets_at<=?")
      .run(now);
    database.exec("COMMIT");
    locked = false;
    return { quarantined: orphanRows.length + orphanFiles.length };
  } catch (error) {
    const errors = [error];
    try {
      if (locked) database.exec("ROLLBACK");
    } catch (rollbackError) {
      errors.push(rollbackError);
    }
    for (const [source, target] of moved.reverse()) {
      try {
        if (existsSync(target)) renameSync(target, source);
      } catch (restoreError) {
        errors.push(restoreError);
      }
    }
    if (errors.length > 1)
      throw new AggregateError(
        errors,
        "Maintenance failed and rollback was incomplete",
      );
    throw error;
  } finally {
    database.close();
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  const { database: databasePath, uploads } = storagePaths();
  console.log(JSON.stringify(runMaintenance({ databasePath, uploads })));
}
