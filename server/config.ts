import path from "node:path";
import { accessSync, constants, mkdirSync, statfsSync } from "node:fs";
export function storagePaths() {
  const database = path.resolve(
    process.env.DM_COMMAND_TABLE_DB_PATH || "data/dm-command-table.sqlite",
  );
  return {
    database,
    uploads: path.resolve(
      process.env.DM_COMMAND_TABLE_UPLOAD_PATH ||
        path.join(path.dirname(database), "uploads"),
    ),
    backups: path.resolve(
      process.env.DM_COMMAND_TABLE_BACKUP_PATH ||
        path.join(path.dirname(database), "backups"),
    ),
  };
}
export function assertStorageReady(): void {
  const paths = storagePaths();
  for (const directory of [path.dirname(paths.database), paths.uploads]) {
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    accessSync(directory, constants.R_OK | constants.W_OK);
    const fs = statfsSync(directory);
    if (fs.bavail * fs.bsize < 16 * 1024 * 1024)
      throw new Error("Local storage has less than 16 MiB available.");
  }
}
