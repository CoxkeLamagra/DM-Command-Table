import { readFileSync } from "node:fs";
const tag = process.argv[2];
const version = JSON.parse(readFileSync("package.json", "utf8")).version;
if (tag !== `v${version}` || !/^v\d+\.\d+\.\d+$/.test(tag))
  throw new Error("Release tag must match the stable package version.");
const sections = readFileSync("CHANGELOG.md", "utf8").split(/^## /m);
const section = sections.find((entry) => entry.startsWith(`${version} — `));
if (!section || section.startsWith(`${version} — unreleased`))
  throw new Error("A dated changelog entry is required before publication.");
const changes = section.slice(section.indexOf("\n") + 1).trim();
console.log(
  `# DM Command Table ${tag}\n\n${changes}\n\n[Installation and release assessment](https://github.com/CoxkeLamagra/DM-Command-Table/blob/${tag}/docs/release-assessment.md).`,
);
