import { writeRuntimeManifest } from "./runtime-integrity.mjs";
import { readFileSync } from "node:fs";
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
const destination = path.resolve(process.argv[2] || "dist/runtime");
if (!existsSync(".next/standalone/server.js"))
  throw new Error("Run pnpm build before packaging the runtime.");
if (existsSync(destination))
  throw new Error("Runtime destination must be empty.");
mkdirSync(destination, { recursive: true });
try {
  cpSync(".next/standalone", destination, {
    recursive: true,
    verbatimSymlinks: true,
  });
  cpSync(".next/static", path.join(destination, ".next/static"), {
    recursive: true,
  });
  cpSync("public", path.join(destination, "public"), { recursive: true });
  const runtimeScripts = path.join(destination, "scripts");
  mkdirSync(runtimeScripts, { recursive: true });
  for (const filename of [
    "backup-local.mjs",
    "check-local-storage.mjs",
    "local-backup.mjs",
    "maintenance.mjs",
    "restore-local.mjs",
    "storage-config.mjs",
    "runtime-integrity.mjs",
  ])
    cpSync(path.join("scripts", filename), path.join(runtimeScripts, filename));
  const updater = path.join(destination, "deploy/debian-13");
  mkdirSync(updater, { recursive: true });
  for (const filename of [
    "install-gui-updater",
    "build-update.mjs",
    "update-broker.mjs",
    "update-dm-command-table",
    "dm-command-table-updater.service",
  ])
    cpSync(
      path.join("deploy/debian-13", filename),
      path.join(updater, filename),
    );
  const metadata = JSON.parse(readFileSync("package.json", "utf8"));
  writeRuntimeManifest(destination, metadata.version);
  console.log(destination);
} catch (error) {
  rmSync(destination, { recursive: true, force: true });
  throw error;
}
