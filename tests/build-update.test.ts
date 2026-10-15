import test from "node:test";
import assert from "node:assert/strict";
import {
  buildUpdate,
  latestRelease,
  validateTarget,
  UPDATE_REPOSITORY,
} from "../deploy/debian-13/build-update.mjs";

test("automatic update selects the latest stable v11 tag and rejects target injection", () => {
  assert.equal(
    latestRelease(
      "a refs/tags/v11.2.0\nb refs/tags/v11.10.0\nc refs/tags/v12.0.0\nd refs/tags/v11.99.0-rc.1\ne refs/tags/v11.10.0^{}",
    ),
    "v11.10.0",
  );
  assert.throws(() => latestRelease("a refs/tags/v12.0.0"), /No stable v11/);
  for (const target of [
    "--help",
    "latest; id",
    "https://other.invalid/repo",
    "v11.1.0/../../x",
  ])
    assert.throws(() => validateTarget(target));
  assert.equal(validateTarget("origin/main"), "origin/main");
});

test("automatic build clones the fixed repository, verifies frozen dependencies and packages only after tests", () => {
  const commands: Array<{
    command: string;
    args: string[];
    cwd: string;
    capture: boolean;
  }> = [];
  const revision = "a".repeat(40);
  const runtime = buildUpdate(
    "/tmp/dmct-build-fixture",
    "latest",
    (command: string, args: string[], cwd: string, capture: boolean) => {
      commands.push({ command, args, cwd, capture });
      if (args[0] === "ls-remote") return `a refs/tags/v11.2.0`;
      if (args[0] === "rev-parse") return revision;
      return "";
    },
  );
  assert.equal(runtime, "/tmp/dmct-build-fixture/runtime");
  assert.deepEqual(commands.find((x) => x.args[0] === "clone")?.args, [
    "clone",
    "--no-checkout",
    UPDATE_REPOSITORY,
    "/tmp/dmct-build-fixture/source",
  ]);
  assert.deepEqual(commands.find((x) => x.args[0] === "checkout")?.args, [
    "checkout",
    "--detach",
    revision,
  ]);
  assert.deepEqual(commands.find((x) => x.args[0] === "install")?.args, [
    "install",
    "--frozen-lockfile",
    "--prod=false",
  ]);
  assert.deepEqual(commands.find((x) => x.args[0] === "audit")?.args, [
    "audit",
  ]);
  const names = commands.map((x) => x.args[0]);
  assert.ok(names.indexOf("test") < names.indexOf("build"));
  assert.ok(names.indexOf("test:browser") > names.indexOf("build"));
  assert.equal(commands.at(-1)?.args[0], "scripts/package-runtime.mjs");
});

test("a failed source verification never reaches build or packaging", () => {
  const commands: string[] = [];
  assert.throws(
    () =>
      buildUpdate(
        "/tmp/dmct-build-failure",
        "origin/main",
        (_command: string, args: string[]) => {
          commands.push(args[0]);
          if (args[0] === "rev-parse") return "b".repeat(40);
          if (args[0] === "lint") throw new Error("lint failed");
          return "";
        },
      ),
    /lint failed/,
  );
  assert.equal(commands.includes("build"), false);
  assert.equal(commands.includes("scripts/package-runtime.mjs"), false);
});

test("build subprocesses exclude production storage and bootstrap settings", () => {
  const saved = {
    NODE_ENV: process.env.NODE_ENV,
    DM_COMMAND_TABLE_DB_PATH: process.env.DM_COMMAND_TABLE_DB_PATH,
    DM_COMMAND_TABLE_BOOTSTRAP_TOKEN:
      process.env.DM_COMMAND_TABLE_BOOTSTRAP_TOKEN,
  };
  const processEnv: Record<string, string | undefined> = process.env;
  processEnv.NODE_ENV = "production";
  process.env.DM_COMMAND_TABLE_DB_PATH = "/production/data.sqlite";
  process.env.DM_COMMAND_TABLE_BOOTSTRAP_TOKEN = "fixture-only";
  try {
    buildUpdate(
      "/tmp/dmct-env-fixture",
      "origin/main",
      (
        _command: string,
        args: string[],
        _cwd: string,
        _capture: boolean,
        env: Record<string, string | undefined>,
      ) => {
        assert.equal(env.NODE_ENV, undefined);
        assert.equal(env.DM_COMMAND_TABLE_DB_PATH, undefined);
        assert.equal(env.DM_COMMAND_TABLE_BOOTSTRAP_TOKEN, undefined);
        assert.equal(
          env.DM_COMMAND_TABLE_TEST_CHROMIUM_PATH,
          "/usr/bin/chromium",
        );
        return args[0] === "rev-parse" ? "c".repeat(40) : "";
      },
    );
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("build command deadlines terminate ordinary descendant processes", async () => {
  const { executeBuildCommand } =
    await import("../deploy/debian-13/build-update.mjs");
  const { mkdtempSync, readFileSync, rmSync, existsSync } =
    await import("node:fs");
  const directory = mkdtempSync("/tmp/dmct-build-deadline-");
  try {
    const childSource = `require('node:fs').writeFileSync(${JSON.stringify(directory + "/pid")},String(process.pid));setInterval(()=>{},1000);`;
    const source = `require('node:child_process').spawn(process.execPath,['-e',${JSON.stringify(childSource)}],{stdio:'ignore'});setInterval(()=>{},1000);`;
    assert.throws(
      () =>
        executeBuildCommand(
          process.execPath,
          ["-e", source],
          directory,
          true,
          process.env,
          1.5,
        ),
      /timed out/,
    );
    const pid = Number(readFileSync(directory + "/pid", "utf8"));
    const file = "/proc/" + pid + "/stat";
    for (let i = 0; i < 40 && existsSync(file); i++) {
      if (/\) [ZX] /.test(readFileSync(file, "utf8"))) break;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    if (existsSync(file)) assert.match(readFileSync(file, "utf8"), /\) [ZX] /);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
