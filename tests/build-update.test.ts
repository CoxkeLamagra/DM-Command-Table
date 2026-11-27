import test from "node:test";
import assert from "node:assert/strict";
import {
  buildUpdate,
  latestRelease,
  validateTarget,
  UPDATE_REPOSITORY,
} from "../deploy/debian-13/build-update.mjs";

test("automatic update selects the latest stable v12 tag and rejects target injection", () => {
  assert.equal(
    latestRelease(
      "a refs/tags/v12.2.0\nb refs/tags/v12.10.0\nc refs/tags/v13.0.0\nd refs/tags/v12.99.0-rc.1\ne refs/tags/v12.10.0^{}\nf refs/tags/v11.99.0",
    ),
    "v12.10.0",
  );
  assert.throws(
    () => latestRelease("a refs/tags/v11.99.0\nb refs/tags/v13.0.0"),
    /No stable v12/,
  );
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
      if (args[0] === "ls-remote") return `a refs/tags/v12.2.0`;
      if (args[0] === "rev-parse") return revision;
      return "";
    },
  );
  assert.equal(runtime, "/tmp/dmct-build-fixture/runtime");
  assert.equal(
    commands.some((x) => x.args[0] === "clone"),
    false,
  );
  assert.deepEqual(commands.find((x) => x.args[0] === "init")?.args, [
    "init",
    "--quiet",
    "/tmp/dmct-build-fixture/source",
  ]);
  // Only the selected release commit is downloaded, without history.
  assert.deepEqual(
    commands.find((x) => x.args[0] === "fetch"),
    {
      command: "/usr/bin/git",
      args: [
        "fetch",
        "--depth=1",
        "--no-tags",
        "--quiet",
        UPDATE_REPOSITORY,
        "+refs/tags/v12.2.0:refs/tags/v12.2.0",
      ],
      cwd: "/tmp/dmct-build-fixture/source",
      capture: false,
    },
  );
  assert.deepEqual(commands.find((x) => x.args[0] === "rev-parse")?.args, [
    "rev-parse",
    "--verify",
    "v12.2.0^{commit}",
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
  const packaged = names.indexOf("scripts/package-runtime.mjs");
  assert.ok(packaged > names.indexOf("test:browser"));
  // The pnpm cache is pruned only after packaging succeeded.
  assert.deepEqual(commands.at(-1)?.args, ["store", "prune"]);
  assert.equal(commands.length - 1, packaged + 1);
});

test("each update target fetches exactly one ref", async () => {
  const { fetchRefspec } = await import("../deploy/debian-13/build-update.mjs");
  assert.equal(fetchRefspec("v12.3.0"), "+refs/tags/v12.3.0:refs/tags/v12.3.0");
  assert.equal(
    fetchRefspec("origin/main"),
    "+refs/heads/main:refs/remotes/origin/main",
  );
  assert.equal(fetchRefspec("d".repeat(40)), "d".repeat(40));
  assert.throws(() => fetchRefspec("latest"), /Resolve latest/);
  assert.throws(() => fetchRefspec("--upload-pack=x"));
});

test("a failed pnpm cache prune does not fail a packaged update", () => {
  const runtime = buildUpdate(
    "/tmp/dmct-prune-fixture",
    "origin/main",
    (_command: string, args: string[]) => {
      if (args[0] === "rev-parse") return "e".repeat(40);
      if (args[0] === "store") throw new Error("prune failed");
      return "";
    },
  );
  assert.equal(runtime, "/tmp/dmct-prune-fixture/runtime");
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
