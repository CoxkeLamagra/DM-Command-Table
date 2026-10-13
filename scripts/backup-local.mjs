import { mkdirSync } from "node:fs";
import path from "node:path";
import { createLocalBackup } from "./local-backup.mjs";
import { storagePaths } from "./storage-config.mjs";
const {
  database: databasePath,
  uploads: uploadPath,
  backups: backupRoot,
} = storagePaths();
mkdirSync(backupRoot, { recursive: true, mode: 0o700 });
const destination = path.join(
  backupRoot,
  new Date().toISOString().replaceAll(":", "-").replace(".", "-") +
    "-" +
    crypto.randomUUID(),
);
console.log(createLocalBackup({ databasePath, uploadPath, destination }));
