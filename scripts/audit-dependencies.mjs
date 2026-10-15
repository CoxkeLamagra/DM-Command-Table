import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import assert from "node:assert/strict";

const result = spawnSync(
  process.platform === "win32" ? "pnpm.cmd" : "pnpm",
  ["audit", "--json"],
  { encoding: "utf8", maxBuffer: 16 * 1024 * 1024, timeout: 120000 },
);
if (result.error) throw result.error;
if (result.signal || ![0, 1].includes(result.status))
  throw new Error("The dependency audit did not complete.");
let audit;
try {
  audit = JSON.parse(result.stdout);
} catch {
  throw new Error("The dependency audit did not return valid JSON.");
}
if (!audit.metadata || audit.error || !audit.advisories)
  throw new Error(
    "The dependency audit failed; registry errors are not ignored.",
  );
const unmitigated = [];
let patched = false;
for (const advisory of Object.values(audit.advisories)) {
  if (
    advisory.github_advisory_id === "GHSA-vfj7-8cjw-p6xm" &&
    advisory.module_name === "braces" &&
    advisory.findings.length > 0 &&
    advisory.findings.every(
      (finding) => finding.dev && finding.version === "3.0.3",
    )
  )
    patched = true;
  else
    unmitigated.push(
      `${advisory.severity}: ${advisory.module_name} ${advisory.github_advisory_id}`,
    );
}
if (patched) {
  let require = createRequire(import.meta.url),
    entry;
  for (const name of [
    "eslint-config-next",
    "@next/eslint-plugin-next",
    "fast-glob",
    "micromatch",
    "braces",
  ]) {
    entry = require.resolve(name);
    require = createRequire(entry);
  }
  const braces = require(entry);
  assert.deepEqual(braces.expand("a/{b,c}"), ["a/b", "a/c"]);
  for (const pattern of [
    "{".repeat(2000) + "x" + "}".repeat(2000),
    "(".repeat(2000) + "x" + ")".repeat(2000),
  ])
    for (const method of ["parse", "compile", "expand", "stringify"])
      assert.throws(() => braces[method](pattern), {
        name: "SyntaxError",
        message: "Brace pattern nesting exceeds 128 levels",
      });
  console.log(
    "Verified local braces@3.0.3 depth patch for development-only GHSA-vfj7-8cjw-p6xm; upstream advisory remains open.",
  );
}
if (unmitigated.length) {
  console.error(unmitigated.join("\n"));
  process.exit(1);
}
if (result.status !== 0 && !patched)
  throw new Error("Dependency audit failed.");
console.log("Dependency audit passed: no unmitigated advisories.");
