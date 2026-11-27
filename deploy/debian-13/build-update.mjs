import { spawnSync } from "node:child_process";
import path from "node:path";
import { existsSync } from "node:fs";
import { pathToFileURL } from "node:url";

export const UPDATE_REPOSITORY =
  "https://github.com/CoxkeLamagra/DM-Command-Table.git";
export function validateTarget(target) {
  if (!/^(latest|origin\/main|v\d+\.\d+\.\d+|[a-f0-9]{40})$/.test(target))
    throw new Error(
      "Use latest, origin/main, a stable release tag or a full commit SHA.",
    );
  return target;
}
export function latestRelease(output) {
  const tags = output
    .split("\n")
    .map((line) => line.split(/\s+/)[1])
    .filter((ref) => /^refs\/tags\/v12\.\d+\.\d+$/.test(ref ?? ""))
    .map((ref) => ref.slice("refs/tags/".length));
  tags.sort((a, b) => {
    const left = a.slice(1).split(".").map(Number),
      right = b.slice(1).split(".").map(Number);
    for (let i = 0; i < 3; i++)
      if (left[i] !== right[i]) return right[i] - left[i];
    return 0;
  });
  if (!tags.length) throw new Error("No stable v12 release is available.");
  return tags[0];
}
// Runs one build command in its own process group and kills the whole group at
// the deadline. This does not rely on /usr/bin/timeout, whose process-group
// handling differs between GNU coreutils and the uutils coreutils shipped by
// newer Ubuntu releases. Leftover group members are also removed when the
// command exits, so no build helper outlives its step.
const DEADLINE_SUPERVISOR = `
const { spawn } = require("node:child_process");
const { constants } = require("node:os");
const [seconds, command, ...args] = process.argv.slice(1);
const child = spawn(command, args, { stdio: "inherit", detached: true });
let timedOut = false;
const killGroup = () => {
  try {
    process.kill(-child.pid, "SIGKILL");
  } catch {}
};
const timer = setTimeout(() => {
  timedOut = true;
  killGroup();
}, Number(seconds) * 1000);
for (const name of ["SIGTERM", "SIGINT", "SIGHUP"])
  process.on(name, () => {
    killGroup();
    process.exit(128 + constants.signals[name]);
  });
child.on("error", () => {
  clearTimeout(timer);
  process.exit(127);
});
child.on("exit", (code, signal) => {
  clearTimeout(timer);
  killGroup();
  if (timedOut) process.exit(124);
  process.exit(code ?? 128 + (constants.signals[signal] ?? 0));
});
`;
export function executeBuildCommand(
  command,
  args,
  cwd,
  capture = false,
  env = process.env,
  timeoutSeconds = 1200,
) {
  const result = spawnSync(
    process.execPath,
    ["-e", DEADLINE_SUPERVISOR, "--", String(timeoutSeconds), command, ...args],
    {
      cwd,
      env,
      encoding: "utf8",
      stdio: capture ? ["ignore", "pipe", "inherit"] : "inherit",
      maxBuffer: 8 * 1024 * 1024,
      // Backstop in case the supervisor itself stops responding.
      timeout: (timeoutSeconds + 30) * 1000,
      killSignal: "SIGKILL",
    },
  );
  if (result.error || result.status !== 0)
    throw new Error(
      `Update command failed or timed out: ${command} ${args.join(" ")}`,
    );
  return result.stdout ?? "";
}
export function buildUpdate(directory, target = "latest", execute) {
  validateTarget(target);
  const root = path.resolve(directory),
    source = path.join(root, "source"),
    runtime = path.join(root, "runtime");
  const env = {
    ...process.env,
    CI: "1",
    GIT_TERMINAL_PROMPT: "0",
    NEXT_TELEMETRY_DISABLED: "1",
    DM_COMMAND_TABLE_TEST_CHROMIUM_PATH: "/usr/bin/chromium",
  };
  // Never pass application storage, bootstrap credentials or settings to build scripts.
  for (const key of Object.keys(env))
    if (
      key.startsWith("DM_COMMAND_TABLE_") &&
      key !== "DM_COMMAND_TABLE_TEST_CHROMIUM_PATH"
    )
      delete env[key];
  delete env.NODE_ENV;
  const runner = execute ?? executeBuildCommand;
  const run = (command, args, cwd, capture = false) =>
    runner(command, args, cwd, capture, env);
  const step = (id) => console.log(`@@STEP ${id}`);
  step("fetch");
  const selected =
    target === "latest"
      ? latestRelease(
          run(
            "/usr/bin/git",
            ["ls-remote", "--tags", "--refs", UPDATE_REPOSITORY],
            root,
            true,
          ),
        )
      : target;
  run(
    "/usr/bin/git",
    ["clone", "--no-checkout", UPDATE_REPOSITORY, source],
    root,
  );
  const revision = run(
    "/usr/bin/git",
    ["rev-parse", "--verify", `${selected}^{commit}`],
    source,
    true,
  ).trim();
  if (!/^[a-f0-9]{40}$/.test(revision))
    throw new Error("The update target did not resolve to a commit.");
  run("/usr/bin/git", ["checkout", "--detach", revision], source);
  console.log(`Resolved ${selected} to ${revision}`);
  step("install");
  run(
    "/usr/bin/pnpm",
    ["install", "--frozen-lockfile", "--prod=false"],
    source,
  );
  step("verify");
  for (const args of [
    existsSync(path.join(source, "scripts/audit-dependencies.mjs"))
      ? ["audit:dependencies"]
      : ["audit"],
    ["format:check"],
    ["lint"],
    ["exec", "tsc", "--noEmit"],
  ])
    run("/usr/bin/pnpm", args, source);
  step("test");
  run("/usr/bin/pnpm", ["test"], source);
  step("build");
  run("/usr/bin/pnpm", ["build"], source);
  step("browser");
  run("/usr/bin/pnpm", ["test:browser"], source);
  step("package");
  run("/usr/bin/node", ["scripts/package-runtime.mjs", runtime], source);
  return runtime;
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  if (process.getuid?.() === 0)
    throw new Error("Build updates as the unprivileged dmct-build account.");
  if (!process.argv[2] || !existsSync(process.argv[2]))
    throw new Error("Provide a new accessible build directory.");
  buildUpdate(process.argv[2], process.argv[3] ?? "latest");
}
