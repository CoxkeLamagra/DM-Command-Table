import { cp, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const root = process.cwd();
const databasePath = path.resolve(
  process.env.DM_COMMAND_TABLE_V6_DB_PATH ??
    path.join(root, "data", "dm-command-table-v6.sqlite"),
);
const uploadPath = path.resolve(
  process.env.DM_COMMAND_TABLE_V6_UPLOAD_PATH ??
    path.join(path.dirname(databasePath), "uploads-v6"),
);
const backupRoot = path.resolve(
  process.env.DM_COMMAND_TABLE_BACKUP_PATH ??
    path.join(path.dirname(databasePath), "backups"),
);
const timestamp = new Date()
  .toISOString()
  .replaceAll(":", "-")
  .replace(".", "-");
const destination = path.join(backupRoot, timestamp);

if (destination === path.dirname(databasePath) || destination === uploadPath) {
  throw new Error(
    "The backup destination must be separate from live application storage.",
  );
}

await mkdir(destination, { recursive: true });
const databaseBackup = path.join(destination, "dm-command-table-v6.sqlite");
const database = new DatabaseSync(databasePath);
try {
  const escapedDestination = databaseBackup.replaceAll("'", "''");
  database.exec(`VACUUM INTO '${escapedDestination}'`);
} finally {
  database.close();
}

await cp(uploadPath, path.join(destination, "uploads-v6"), {
  recursive: true,
  force: false,
}).catch((error) => {
  if (error?.code !== "ENOENT") throw error;
});
await writeFile(
  path.join(destination, "manifest.json"),
  `${JSON.stringify({ createdAt: new Date().toISOString(), databasePath, uploadPath }, null, 2)}\n`,
  { flag: "wx" },
);

console.log(destination);
