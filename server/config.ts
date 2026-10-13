import path from "node:path";
import { accessSync, constants, mkdirSync, statfsSync } from "node:fs";
import { storagePaths } from "../scripts/storage-config.mjs";
export { storagePaths };
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
