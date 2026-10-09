import { mkdirSync } from "node:fs";
import path from "node:path";
import { createLocalBackup } from "./local-backup.mjs";
const databasePath = path.resolve(
  process.env.DM_COMMAND_TABLE_DB_PATH ?? "data/dm-command-table.sqlite",
);
const uploadPath = path.resolve(
  process.env.DM_COMMAND_TABLE_UPLOAD_PATH ??
    path.join(path.dirname(databasePath), "uploads"),
);
const backupRoot = path.resolve(
  process.env.DM_COMMAND_TABLE_BACKUP_PATH ??
    path.join(path.dirname(databasePath), "backups"),
);
mkdirSync(backupRoot, { recursive: true, mode: 0o700 });
const destination = path.join(
  backupRoot,
  new Date().toISOString().replaceAll(":", "-").replace(".", "-") +
    "-" +
    crypto.randomUUID(),
);
console.log(createLocalBackup({ databasePath, uploadPath, destination }));
