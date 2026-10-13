import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  cpSync,
  symlinkSync,
  realpathSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import { runMigrations } from "../db/migrations.ts";

// Execute the actual deployment shell logic in an isolated filesystem. Only
// privileged identities, systemd and remote build prerequisites are simulated;
// release links, health-version parsing, SQLite backup and restore are real.
function fixture(mode: string) {
  const root = mkdtempSync(path.join(tmpdir(), "dmct-deployment-"));
  for (const folder of [
    "bin",
    "lib",
    "base/releases/old/scripts",
    "data/uploads",
    "data/backups",
  ])
    mkdirSync(path.join(root, folder), { recursive: true });
  const old = path.join(root, "base/releases/old");
  writeFileSync(
    path.join(old, "runtime-manifest.json"),
    JSON.stringify({ applicationVersion: "11.1.0" }),
  );
  symlinkSync(old, path.join(root, "base/current"));
  for (const file of [
    "backup-local.mjs",
    "local-backup.mjs",
    "restore-local.mjs",
    "storage-config.mjs",
  ])
    cpSync(path.join("scripts", file), path.join(old, "scripts", file));
  const db = new DatabaseSync(path.join(root, "data/live.sqlite"));
  runMigrations(db);
  db.exec(
    "INSERT INTO users VALUES('owner','Before update','owner','fixture-hash',1,1,1)",
  );
  db.close();
  writeFileSync(
    path.join(root, "environment"),
    `DM_COMMAND_TABLE_DB_PATH=${root}/data/live.sqlite\nDM_COMMAND_TABLE_UPLOAD_PATH=${root}/data/uploads\nDM_COMMAND_TABLE_BACKUP_PATH=${root}/data/backups\n`,
  );
  function stub(name: string, body: string) {
    writeFileSync(
      path.join(root, "bin", name),
      `#!${process.execPath}\n${body}`,
      { mode: 0o755 },
    );
  }
  stub("id", "if(process.argv[2]==='-u') console.log('0');");
  stub("chown", "");
  stub("sleep", "");
  stub("pnpm", "");
  stub("chromium", "");
  stub(
    "install",
    `const {spawnSync}=require('node:child_process'); const args=process.argv.slice(2).filter((v,i,a)=> !['-o','-g'].includes(v) && !['-o','-g'].includes(a[i-1])); const r=spawnSync('/usr/bin/install',args,{stdio:'inherit'});process.exit(r.status??1);`,
  );
  stub(
    "runuser",
    `const {spawnSync}=require('node:child_process');const args=process.argv.slice(2);while(args[0]!=='--') args.shift();args.shift(); const r=spawnSync(args.shift(),args,{stdio:'inherit',env:process.env});process.exit(r.status??1);`,
  );
  stub(
    "systemctl",
    `const fs=require('node:fs');fs.appendFileSync(process.env.DMCT_FIXTURE_ROOT+'/service.log',process.argv.slice(2).join(' ')+'\\n');if(process.argv[2]==='start' && process.env.DMCT_FIXTURE_MODE==='rollback' && fs.realpathSync(process.env.DMCT_FIXTURE_ROOT+'/base/current')!==process.env.DMCT_FIXTURE_ROOT+'/base/releases/old'){const {DatabaseSync}=require('node:sqlite');const db=new DatabaseSync(process.env.DM_COMMAND_TABLE_DB_PATH);db.exec("UPDATE users SET display_name='Candidate changed data'");db.close();}`,
  );
  stub(
    "curl",
    `const fs=require('node:fs');const root=process.env.DMCT_FIXTURE_ROOT,current=fs.realpathSync(root+'/base/current');const v=JSON.parse(fs.readFileSync(current+'/runtime-manifest.json','utf8')).applicationVersion;console.log(JSON.stringify({status:'ready',version:process.env.DMCT_FIXTURE_MODE==='rollback'&&current!==root+'/base/releases/old'?'wrong-version':v}));`,
  );
  writeFileSync(
    path.join(root, "lib/runtime-integrity.mjs"),
    `import {readFileSync} from 'node:fs';console.log(readFileSync(process.argv[2]+'/runtime-manifest.json','utf8'));`,
  );
  writeFileSync(
    path.join(root, "lib/build-update.mjs"),
    `import {mkdirSync,writeFileSync} from 'node:fs';console.log('@@STEP fetch');console.log('@@STEP build');if(process.env.DMCT_FIXTURE_MODE==='build-failure')process.exit(1);const runtime=process.argv[2]+'/runtime';mkdirSync(runtime);writeFileSync(runtime+'/runtime-manifest.json',JSON.stringify({applicationVersion:'11.2.0'}));writeFileSync(runtime+'/server.js','// fixture candidate');`,
  );
  let script = readFileSync("deploy/debian-13/update-dm-command-table", "utf8");
  script = script
    .replace("BASE=/opt/dm-command-table", `BASE=${root}/base`)
    .replaceAll("/usr/local/lib/dm-command-table", root + "/lib")
    .replaceAll("/etc/dm-command-table.env", root + "/environment")
    .replaceAll("/var/lib/dm-command-table/restored-", root + "/data/restored-")
    .replaceAll("/run/lock/dm-command-table-update.lock", root + "/update.lock")
    .replaceAll(
      "CI=1 NEXT_TELEMETRY_DISABLED=1",
      `CI=1 NEXT_TELEMETRY_DISABLED=1 DMCT_FIXTURE_MODE=${mode} DMCT_FIXTURE_ROOT=${root}`,
    )
    .replaceAll("/usr/bin/node", process.execPath)
    .replaceAll("/usr/bin/pnpm", root + "/bin/pnpm")
    .replaceAll("/usr/bin/chromium", root + "/bin/chromium");
  writeFileSync(path.join(root, "updater"), script);
  const result = spawnSync("bash", [path.join(root, "updater")], {
    env: {
      ...process.env,
      PATH: root + "/bin:" + process.env.PATH,
      DMCT_FIXTURE_ROOT: root,
      DMCT_FIXTURE_MODE: mode,
    },
    encoding: "utf8",
  });
  return { root, old, result };
}

test("automatic build failures preserve the active release and never stop the application", () => {
  const f = fixture("build-failure");
  try {
    assert.notEqual(f.result.status, 0);
    assert.equal(realpathSync(path.join(f.root, "base/current")), f.old);
    assert.throws(() => readFileSync(path.join(f.root, "service.log")));
  } finally {
    rmSync(f.root, { recursive: true, force: true });
  }
});
test("a successful automatic build backs up data and switches to a verified healthy version", () => {
  const f = fixture("success");
  try {
    assert.equal(f.result.status, 0, f.result.stderr);
    assert.notEqual(realpathSync(path.join(f.root, "base/current")), f.old);
    assert.match(
      f.result.stdout,
      /@@STEP backup[\s\S]*@@STEP switch[\s\S]*@@STEP health/,
    );
    assert.match(
      readFileSync(path.join(f.root, "service.log"), "utf8"),
      /stop dm-command-table.service\nstart dm-command-table.service/,
    );
    assert.match(f.result.stdout, /Application update completed/);
  } finally {
    rmSync(f.root, { recursive: true, force: true });
  }
});
test("wrong-version health restores the prior code and its stopped-service SQLite backup", () => {
  const f = fixture("rollback");
  try {
    assert.notEqual(f.result.status, 0);
    assert.equal(realpathSync(path.join(f.root, "base/current")), f.old);
    assert.match(f.result.stdout, /@@DONE rollback/);
    const config = readFileSync(path.join(f.root, "environment"), "utf8");
    const restored = config.match(/^DM_COMMAND_TABLE_DB_PATH=(.+)$/m)![1];
    assert.notEqual(restored, path.join(f.root, "data/live.sqlite"));
    const db = new DatabaseSync(restored, { readOnly: true });
    assert.equal(
      db.prepare("SELECT display_name FROM users").get()!.display_name,
      "Before update",
    );
    db.close();
  } finally {
    rmSync(f.root, { recursive: true, force: true });
  }
});
