import {
  cpSync,
  existsSync,
  mkdirSync,
  rmSync,
  readdirSync,
  realpathSync,
} from "node:fs";
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
  mkdirSync(runtimeScripts);
  for (const filename of [
    "backup-local.mjs",
    "check-local-storage.mjs",
    "local-backup.mjs",
    "maintenance.mjs",
    "restore-local.mjs",
  ])
    cpSync(path.join("scripts", filename), path.join(runtimeScripts, filename));
  function checkLinks(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const filename = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) {
        const relative = path.relative(destination, realpathSync(filename));
        if (
          relative === ".." ||
          relative.startsWith(".." + path.sep) ||
          path.isAbsolute(relative)
        )
          throw new Error(
            "Runtime dependency link escapes the package: " + filename,
          );
      } else if (entry.isDirectory()) checkLinks(filename);
    }
  }
  checkLinks(destination);
  console.log(destination);
} catch (error) {
  rmSync(destination, { recursive: true, force: true });
  throw error;
}
