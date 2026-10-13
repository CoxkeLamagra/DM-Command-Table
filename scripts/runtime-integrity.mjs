import { createHash } from "node:crypto";
import {
  closeSync,
  lstatSync,
  openSync,
  readFileSync,
  readlinkSync,
  readSync,
  readdirSync,
  realpathSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const RUNTIME_BASELINE = "offline-runtime-baseline";
const manifestName = "runtime-manifest.json";
function hash(filename) {
  const digest = createHash("sha256"),
    handle = openSync(filename, "r"),
    buffer = Buffer.allocUnsafe(65536);
  try {
    let bytes;
    while ((bytes = readSync(handle, buffer, 0, buffer.length, null)) > 0)
      digest.update(buffer.subarray(0, bytes));
    return digest.digest("hex");
  } finally {
    closeSync(handle);
  }
}
function inventory(directory) {
  const root = realpathSync(directory),
    files = {};
  function visit(folder) {
    for (const entry of readdirSync(folder, { withFileTypes: true }).sort(
      (a, b) => a.name.localeCompare(b.name),
    )) {
      const filename = path.join(folder, entry.name),
        relative = path.relative(root, filename);
      if (relative === manifestName) continue;
      if (entry.isSymbolicLink()) {
        const target = readlinkSync(filename),
          resolved = path.relative(root, realpathSync(filename));
        if (
          path.isAbsolute(target) ||
          resolved === ".." ||
          resolved.startsWith(".." + path.sep)
        )
          throw new Error(
            "Runtime dependency link escapes the package: " + filename,
          );
        files[relative] = { link: target };
      } else if (entry.isDirectory()) visit(filename);
      else if (entry.isFile()) files[relative] = { sha256: hash(filename) };
      else throw new Error("Unsupported runtime entry: " + relative);
    }
  }
  visit(root);
  return files;
}
export function writeRuntimeManifest(directory, version) {
  const manifest = {
    format: "dmct-runtime",
    version: 1,
    applicationVersion: version,
    baseline: RUNTIME_BASELINE,
    files: inventory(directory),
  };
  writeFileSync(
    path.join(directory, manifestName),
    JSON.stringify(manifest, null, 2) + "\n",
    { mode: 0o644 },
  );
}
export function verifyRuntime(directory) {
  const manifest = JSON.parse(
    readFileSync(path.join(directory, manifestName), "utf8"),
  );
  if (
    manifest.format !== "dmct-runtime" ||
    manifest.version !== 1 ||
    manifest.baseline !== RUNTIME_BASELINE ||
    typeof manifest.applicationVersion !== "string"
  )
    throw new Error(
      "Unsupported runtime package; use a fresh installation for a different baseline.",
    );
  const actual = inventory(directory);
  if (
    !actual["server.js"] ||
    !actual["scripts/backup-local.mjs"] ||
    !actual["scripts/restore-local.mjs"]
  )
    throw new Error("Incomplete runtime package.");
  if (
    !manifest.files ||
    Object.keys(actual).length !== Object.keys(manifest.files).length ||
    Object.entries(actual).some(
      ([name, value]) =>
        JSON.stringify(value) !== JSON.stringify(manifest.files[name]),
    )
  )
    throw new Error("Runtime package checksum or file inventory mismatch.");
  return manifest;
}
// The manifest detects transfer damage. Trust comes from root approving and
// staging the artifact, not from checksums supplied alongside executable code.
export function assertTrustedStaging(directory) {
  let filename = path.resolve(directory);
  while (true) {
    const info = lstatSync(filename);
    if (!info.isDirectory() || info.uid !== 0 || info.mode & 0o022)
      throw new Error(
        "Staging path must be root-owned and not writable by group/others: " +
          filename,
      );
    if (filename === path.dirname(filename)) break;
    filename = path.dirname(filename);
  }
  function visit(folder) {
    for (const entry of readdirSync(folder, { withFileTypes: true })) {
      const filename = path.join(folder, entry.name),
        info = lstatSync(filename);
      if (info.uid !== 0 || (!info.isSymbolicLink() && info.mode & 0o022))
        throw new Error(
          "Staged runtime must be root-owned and not writable by group/others.",
        );
      if (info.isDirectory()) visit(filename);
    }
  }
  visit(directory);
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  const directory = process.argv[2];
  if (!directory) throw new Error("Provide a runtime directory.");
  if (process.argv[3] === "--trusted-staging") assertTrustedStaging(directory);
  console.log(
    JSON.stringify({
      applicationVersion: verifyRuntime(directory).applicationVersion,
      baseline: RUNTIME_BASELINE,
    }),
  );
}
