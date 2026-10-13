import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createServer as createSocketServer } from "node:net";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  rmSync,
  statSync,
  realpathSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import { runMigrations } from "../db/migrations.ts";
import { registerUser, registrationStatus } from "../server/identity/auth.ts";
import { checkInstallation } from "../deploy/debian-13/check-installation.mjs";

// Run the actual standalone installer in a disposable filesystem. OS packages,
// identities, systemd and the expensive remote build are simulated; copying,
// links, permissions, token generation and refusal to overwrite are real.
function installFixture(mode: string) {
  const root = mkdtempSync(path.join(tmpdir(), "dmct-install-test-"));
  for (const folder of [
    "bin",
    "etc/apt/sources.list.d",
    "etc/systemd/system",
    "etc/nginx/sites-available",
    "etc/nginx/sites-enabled",
    "var/cache",
    "var/lib",
    "opt",
    "usr/local/sbin",
    "run/lock",
  ])
    mkdirSync(path.join(root, folder), { recursive: true });
  writeFileSync(root + "/os-release", "ID=debian\nVERSION_ID=13\n");
  writeFileSync(root + "/pid1", "systemd\n");
  function stub(name: string, body: string) {
    writeFileSync(root + "/bin/" + name, `#!${process.execPath}\n${body}`, {
      mode: 0o755,
    });
  }
  const preamble = `const fs=require('node:fs'),cp=require('node:child_process'),root=${JSON.stringify(root)},args=process.argv.slice(2);`;
  stub("id", "console.log('0');");
  stub("getent", "process.exit(2);");
  stub("dpkg", "console.log('amd64');");
  stub(
    "apt-get",
    preamble +
      `fs.appendFileSync(root+'/commands', 'apt '+args.join(' ')+'\\n');`,
  );
  stub("chown", "");
  stub("npm", "");
  stub(
    "pnpm",
    preamble +
      `fs.appendFileSync(root+'/commands','pnpm '+args.join(' ')+'\\n');if(args[0]==='--version')console.log('11.25.0');if(args[0]==='verify' && ${JSON.stringify(mode)}==='build-failure')process.exit(1);if(args[0]==='install'){if(Object.keys(process.env).some(k=>k.startsWith('DM_COMMAND_TABLE_')&&k!=='DM_COMMAND_TABLE_TEST_CHROMIUM_PATH'))process.exit(9);if(process.env.NODE_ENV)process.exit(10);}`,
  );
  stub(
    "curl",
    preamble +
      `fs.writeFileSync(args[args.indexOf('--output')+1],'fixture key');`,
  );
  stub(
    "gpg",
    preamble +
      `fs.writeFileSync(args[args.indexOf('--output')+1],'fixture key');`,
  );
  stub("nginx", "");
  stub("useradd", "");
  stub("hostname", "console.log('192.0.2.10');");
  stub(
    "install",
    preamble +
      `const filtered=args.filter((v,i)=>!['-o','-g'].includes(v)&&!['-o','-g'].includes(args[i-1]));const r=cp.spawnSync('/usr/bin/install',filtered,{stdio:'inherit'});process.exit(r.status??1);`,
  );
  stub(
    "runuser",
    preamble +
      `const i=args.indexOf('--'),command=args[i+1],r=cp.spawnSync(command,args.slice(i+2),{stdio:'inherit'});process.exit(r.status??1);`,
  );
  stub(
    "systemctl",
    preamble +
      `fs.appendFileSync(root+'/commands','systemctl '+args.join(' ')+'\\n');`,
  );
  stub(
    "git",
    preamble +
      `if(args[0]==='rev-parse')console.log('a'.repeat(40));if(args[0]==='clone'){const source=args.at(-1);fs.mkdirSync(source,{recursive:true});fs.cpSync(${JSON.stringify(path.resolve("deploy"))},source+'/deploy',{recursive:true});fs.cpSync(${JSON.stringify(path.resolve("scripts"))},source+'/scripts',{recursive:true});fs.writeFileSync(source+'/deploy/debian-13/install-gui-updater','#!/bin/bash\\necho updater-enabled >> '+root+'/commands\\n');}`,
  );
  stub(
    "node",
    preamble +
      `if(args[0]==='-p'){console.log('24');process.exit(0);}if(args[0]==='scripts/package-runtime.mjs'){fs.mkdirSync(args[1]+'/scripts',{recursive:true});fs.writeFileSync(args[1]+'/server.js','// fixture');fs.writeFileSync(args[1]+'/runtime-manifest.json',JSON.stringify({applicationVersion:'11.3.0'}));fs.writeFileSync(args[1]+'/scripts/check-local-storage.mjs','');process.exit(0);}if(args[0]?.endsWith('/runtime-integrity.mjs'))process.exit(0);if(args[0]?.endsWith('/check-installation.mjs')){fs.appendFileSync(root+'/commands','readiness-check\\n');process.exit(${mode === "health-failure" ? 1 : 0});}const r=cp.spawnSync(${JSON.stringify(process.execPath)},args,{stdio:'inherit'});process.exit(r.status??1);`,
  );
  let script = readFileSync("deploy/debian-13/install-dm-command-table", "utf8")
    .replace(
      "export PATH=/usr/sbin:/usr/bin:/sbin:/bin",
      `export PATH=${root}/bin:/usr/sbin:/usr/bin:/sbin:/bin`,
    )
    .replaceAll(
      "/run/lock/dm-command-table-install.lock",
      root + "/run/lock/dm-command-table-install.lock",
    )
    .replaceAll("/etc/os-release", root + "/os-release")
    .replaceAll("/proc/1/comm", root + "/pid1")
    .replaceAll("/opt/dm-command-table", root + "/opt/dm-command-table")
    .replaceAll("/var/lib/dm-command-table", root + "/var/lib/dm-command-table")
    .replaceAll(
      "/var/cache/dm-command-table-build",
      root + "/var/cache/dm-command-table-build",
    )
    .replaceAll(
      "/usr/local/lib/dm-command-table",
      root + "/usr/local/lib/dm-command-table",
    )
    .replaceAll(
      "/usr/local/sbin/update-dm-command-table",
      root + "/usr/local/sbin/update-dm-command-table",
    )
    .replaceAll("/etc/dm-command-table.env", root + "/etc/dm-command-table.env")
    .replaceAll("/etc/systemd/system", root + "/etc/systemd/system")
    .replaceAll("/etc/nginx", root + "/etc/nginx")
    .replaceAll("/etc/apt", root + "/etc/apt")
    .replaceAll(
      "PATH=/usr/sbin:/usr/bin:/sbin:/bin",
      `PATH=${root}/bin:/usr/sbin:/usr/bin:/sbin:/bin`,
    );
  for (const executable of ["node", "pnpm", "npm", "git"])
    script = script.replaceAll(
      `/usr/bin/${executable}`,
      root + "/bin/" + executable,
    );
  writeFileSync(root + "/installer", script);
  if (mode === "existing") {
    mkdirSync(root + "/var/lib/dm-command-table");
    writeFileSync(root + "/var/lib/dm-command-table/keep", "original data");
  }
  const run = () =>
    spawnSync("bash", [root + "/installer"], {
      encoding: "utf8",
      env: {
        ...process.env,
        DM_COMMAND_TABLE_BOOTSTRAP_TOKEN: "must-not-enter-build",
        NODE_ENV: "production",
      },
    });
  return { root, result: run(), run };
}

test("fresh installer provisions services and returns a protected token that registers the first administrator", async () => {
  const f = installFixture("success");
  const db = new DatabaseSync(":memory:");
  const oldToken = process.env.DM_COMMAND_TABLE_BOOTSTRAP_TOKEN,
    oldMode = process.env.NODE_ENV;
  try {
    assert.equal(f.result.status, 0, f.result.stderr);
    const config = readFileSync(f.root + "/etc/dm-command-table.env", "utf8");
    const token = config.match(
      /^DM_COMMAND_TABLE_BOOTSTRAP_TOKEN=([a-f0-9]{64})$/m,
    )![1];
    assert.match(
      f.result.stdout,
      new RegExp(`Initial install token: ${token}`),
    );
    assert.equal(
      statSync(f.root + "/etc/dm-command-table.env").mode & 0o777,
      0o600,
    );
    assert.equal(
      realpathSync(f.root + "/opt/dm-command-table/current"),
      f.root + "/opt/dm-command-table/releases/initial",
    );
    const commands = readFileSync(f.root + "/commands", "utf8");
    assert.match(commands, /apt install.*chromium/);
    assert.match(commands, /pnpm install --frozen-lockfile --prod=false/);
    assert.match(commands, /pnpm verify[\s\S]*pnpm test:browser/);
    assert.match(
      commands,
      /updater-enabled[\s\S]*enable --now nginx.service dm-command-table.service dm-command-table-backup.timer[\s\S]*readiness-check[\s\S]*start dm-command-table-backup.service/,
    );
    const processEnv: Record<string, string | undefined> = process.env;
    processEnv.NODE_ENV = "production";
    process.env.DM_COMMAND_TABLE_BOOTSTRAP_TOKEN = token;
    runMigrations(db);
    const input = {
      username: "installer-admin",
      displayName: "Administrator",
      password: "long-enough-install-password",
    };
    await assert.rejects(registerUser(db, input), /token is invalid/);
    const user = await registerUser(db, { ...input, bootstrapToken: token });
    assert.equal(user.isAdmin, true);
    assert.equal(registrationStatus(db).registrationEnabled, false);
    const retry = f.run();
    assert.notEqual(retry.status, 0);
    assert.equal(
      readFileSync(f.root + "/etc/dm-command-table.env", "utf8"),
      config,
    );
    assert.doesNotMatch(retry.stdout, /Initial install token:/);
  } finally {
    if (oldToken === undefined)
      delete process.env.DM_COMMAND_TABLE_BOOTSTRAP_TOKEN;
    else process.env.DM_COMMAND_TABLE_BOOTSTRAP_TOKEN = oldToken;
    const processEnv: Record<string, string | undefined> = process.env;
    if (oldMode === undefined) delete processEnv.NODE_ENV;
    else processEnv.NODE_ENV = oldMode;
    db.close();
    rmSync(f.root, { recursive: true, force: true });
  }
});
for (const mode of ["existing", "build-failure", "health-failure"]) {
  test(`installer refuses ${mode} without advertising success or an install token`, () => {
    const f = installFixture(mode);
    try {
      assert.notEqual(f.result.status, 0);
      assert.doesNotMatch(
        f.result.stdout,
        /Initial install token:|Installation complete/,
      );
      if (mode === "build-failure")
        assert.match(
          f.result.stderr,
          /failed during Audit, checks, unit tests and production build/,
        );
      if (mode === "health-failure")
        assert.match(f.result.stderr, /failed during Verify installation/);
      if (mode === "existing") {
        assert.equal(
          readFileSync(f.root + "/var/lib/dm-command-table/keep", "utf8"),
          "original data",
        );
        assert.throws(() => readFileSync(f.root + "/commands"));
      }
    } finally {
      rmSync(f.root, { recursive: true, force: true });
    }
  });
}

test("installation probe exercises real HTTP and updater sockets and rejects unhealthy boundaries", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "dmct-install-probe-"));
  let version = "11.3.0",
    unauthorized = 401,
    target = "latest";
  const server = createServer((req, res) => {
    if (req.url === "/api/health")
      res.end(JSON.stringify({ status: "ready", version }));
    else {
      res.statusCode = unauthorized;
      res.end();
    }
  });
  const broker = createSocketServer((socket) =>
    socket.on("data", () =>
      socket.end(JSON.stringify({ available: true, target })),
    ),
  );
  try {
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    await new Promise<void>((resolve) =>
      broker.listen(root + "/control.sock", resolve),
    );
    const address = server.address() as { port: number };
    const origin = `http://127.0.0.1:${address.port}`;
    const options = {
      direct: origin,
      proxy: origin,
      socketPath: root + "/control.sock",
      attempts: 1,
    };
    await checkInstallation("11.3.0", options);
    version = "11.2.1";
    await assert.rejects(
      checkInstallation("11.3.0", options),
      /expected version/,
    );
    version = "11.3.0";
    unauthorized = 200;
    await assert.rejects(
      checkInstallation("11.3.0", options),
      /must return 401/,
    );
    unauthorized = 401;
    target = "staged";
    await assert.rejects(
      checkInstallation("11.3.0", options),
      /Automatic updater/,
    );
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await new Promise<void>((resolve) => broker.close(() => resolve()));
    rmSync(root, { recursive: true, force: true });
  }
});
