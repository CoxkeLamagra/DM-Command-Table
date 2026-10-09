import {
  mkdirSync,
  renameSync,
  readdirSync,
  statSync,
  existsSync,
} from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
const databasePath = path.resolve(
  process.env.DM_COMMAND_TABLE_DB_PATH || "data/dm-command-table.sqlite",
);
const uploads = path.resolve(
  process.env.DM_COMMAND_TABLE_UPLOAD_PATH ||
    path.join(path.dirname(databasePath), "uploads"),
);
const quarantine = path.join(path.dirname(uploads), "media-quarantine");
mkdirSync(uploads, { recursive: true, mode: 0o700 });
const moved = [];
const database = new DatabaseSync(databasePath);
database.exec("PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000");
try {
  database.exec("BEGIN IMMEDIATE");
  const referenced = new Set(
    database
      .prepare("SELECT DISTINCT screenshot_id AS id FROM screenshot_references")
      .all()
      .map((row) => row.id),
  );
  const orphanRows = database
    .prepare(
      `SELECT id,filename FROM screenshots WHERE uploaded_by IS NULL OR (staging=1 AND created_at<${Date.now() - 24 * 60 * 60 * 1000})`,
    )
    .all()
    .filter(
      (row) =>
        !referenced.has(row.id) &&
        !database
          .prepare(
            "SELECT 1 FROM combat_history WHERE before_state LIKE ? LIMIT 1",
          )
          .get("%" + row.id + "%"),
    );
  // Removed accounts' unreferenced files are quarantined, never irreversibly purged.
  if (orphanRows.length)
    mkdirSync(quarantine, { recursive: true, mode: 0o700 });
  for (const row of orphanRows) {
    if (!/^[0-9a-f-]+\.webp$/i.test(row.filename))
      throw new Error("Invalid asset filename");
    const source = path.join(uploads, row.filename);
    if (existsSync(source)) {
      const target = path.join(quarantine, row.filename);
      renameSync(source, target);
      moved.push([source, target]);
    }
    database.prepare("DELETE FROM screenshots WHERE id=?").run(row.id);
  }
  const known = new Set(
    database
      .prepare("SELECT filename FROM screenshots")
      .all()
      .map((row) => row.filename),
  );
  const orphanFiles = readdirSync(uploads).filter(
    (file) =>
      /^[0-9a-f-]+\.webp$/i.test(file) &&
      !known.has(file) &&
      Date.now() - statSync(path.join(uploads, file)).mtimeMs >
        24 * 60 * 60 * 1000,
  );
  if (orphanFiles.length)
    mkdirSync(quarantine, { recursive: true, mode: 0o700 });
  for (const file of orphanFiles) {
    const source = path.join(uploads, file),
      target = path.join(quarantine, file);
    renameSync(source, target);
    moved.push([source, target]);
  }
  database
    .prepare("DELETE FROM local_sessions WHERE expires_at<=?")
    .run(Date.now());
  database
    .prepare("DELETE FROM security_rate_limits WHERE resets_at<=?")
    .run(Date.now());
  database.exec("COMMIT");
  console.log(
    JSON.stringify({ quarantined: orphanRows.length + orphanFiles.length }),
  );
} catch (error) {
  database.exec("ROLLBACK");
  for (const [source, target] of moved.reverse())
    if (existsSync(target)) renameSync(target, source);
  throw error;
} finally {
  database.close();
}
