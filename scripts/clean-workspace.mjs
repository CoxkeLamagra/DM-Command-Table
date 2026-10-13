import { rmSync, readdirSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

// Delete only rebuildable output. Application data, environment files and
// dependencies are deliberately outside this allowlist.
export function cleanWorkspace(root = process.cwd()) {
  for (const name of [
    ".next",
    "dist",
    "out",
    "coverage",
    "playwright-report",
    "test-results",
  ])
    rmSync(path.join(root, name), { recursive: true, force: true });
  for (const name of readdirSync(root))
    if (name.endsWith(".tsbuildinfo") || name === "next-env.d.ts")
      rmSync(path.join(root, name), { force: true });
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  cleanWorkspace();
  console.log(
    "Generated build and test output removed. Data, configuration and dependencies preserved.",
  );
}
