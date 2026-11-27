import { mkdirSync } from "node:fs";
import path from "node:path";
import {
  backupRetention,
  createLocalBackup,
  pruneLocalBackups,
} from "./local-backup.mjs";
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
let keep = 0;
try {
  keep = backupRetention(process.env.DM_COMMAND_TABLE_BACKUP_KEEP);
} catch (error) {
  console.error(`${error.message} Keeping every backup.`);
}
console.log(createLocalBackup({ databasePath, uploadPath, destination }));
// Only after the new backup is verified. Messages go to stderr because the
// updater reads the backup path from stdout.
try {
  for (const folder of pruneLocalBackups(backupRoot, keep))
    console.error(`Removed old backup ${folder}`);
} catch (error) {
  console.error(`Could not remove old backups: ${error.message}`);
}
