import path from "node:path";
import { restoreLocalBackup, verifyBackup } from "./local-backup.mjs";
const [source, destination] = process.argv.slice(2);
if (!source)
  throw new Error(
    "Usage: node scripts/restore-local.mjs <backup-directory> [new-empty-destination]",
  );
const result = destination
  ? restoreLocalBackup(path.resolve(source), path.resolve(destination))
  : verifyBackup(path.resolve(source));
console.log(
  JSON.stringify({ verified: true, restored: Boolean(destination), ...result }),
);
