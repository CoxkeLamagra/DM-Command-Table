import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
const destination = path.resolve(process.argv[2] || "dist/runtime");
if (!existsSync(".next/standalone/server.js"))
  throw new Error("Run pnpm build before packaging the runtime.");
if (existsSync(destination))
  throw new Error("Runtime destination must be empty.");
mkdirSync(destination, { recursive: true });
try {
  cpSync(".next/standalone", destination, { recursive: true });
  cpSync(".next/static", path.join(destination, ".next/static"), {
    recursive: true,
  });
  cpSync("public", path.join(destination, "public"), { recursive: true });
  cpSync("scripts", path.join(destination, "scripts"), { recursive: true });
  console.log(destination);
} catch (error) {
  rmSync(destination, { recursive: true, force: true });
  throw error;
}
