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
  readdirSync,
  rmSync,
  utimesSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import { migrations, runMigrations } from "../db/migrations.ts";

// Execute the actual deployment shell logic in an isolated filesystem. Only
// privileged identities, systemd and remote build prerequisites are simulated;
// release links, health-version parsing, SQLite backup and restore are real.
// A database as v12.1.x leaves it: schema 3 with a Player and its search entry.
function createSchemaThreeData(db: DatabaseSync) {
  db.function("dmct_sha256", { deterministic: true }, (value) => String(value));
  for (const migration of migrations.slice(0, 3)) db.exec(migration.sql);
  db.exec(
    "CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY,name TEXT,applied_at INTEGER)",
  );
  for (const migration of migrations.slice(0, 3))
    db.prepare("INSERT INTO schema_migrations VALUES(?,?,1)").run(
      migration.version,
      migration.name,
    );
  db.exec(
    "INSERT INTO users VALUES('dm','DM','dm','fixture-hash',0,1,1); INSERT INTO campaigns(id,owner_id,name,created_at,updated_at) VALUES('campaign','dm','Campaign',1,1); INSERT INTO players(id,campaign_id,name,kind,created_at,updated_at) VALUES('player','campaign','Shadowheart','player',1,1); INSERT INTO search_index(campaign_id,resource_type,resource_id,title,content) VALUES('campaign','player','player','Shadowheart','silver moon')",
  );
}

function schemaVersion(file: string): number {
  const db = new DatabaseSync(file, { readOnly: true });
  try {
    return (
      db
        .prepare("SELECT MAX(version) AS version FROM schema_migrations")
        .get() as { version: number }
    ).version;
  } finally {
    db.close();
  }
}

function fixture(
  mode: string,
  options: {
    env?: Record<string, string>;
    prepare?: (root: string) => void;
  } = {},
) {
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
  const schemaUpgrade = mode.startsWith("schema-upgrade");
  if (schemaUpgrade) createSchemaThreeData(db);
  else runMigrations(db);
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
    `const fs=require('node:fs');const root=process.env.DMCT_FIXTURE_ROOT,current=fs.realpathSync(root+'/base/current');const v=JSON.parse(fs.readFileSync(current+'/runtime-manifest.json','utf8')).applicationVersion;const candidate=current!==root+'/base/releases/old';if(process.env.DMCT_FIXTURE_MODE.startsWith('schema-upgrade')&&candidate){const r=require('node:child_process').spawnSync(process.execPath,['--experimental-strip-types','--no-warnings',root+'/lib/fixture-health.mjs',v],{env:process.env,encoding:'utf8'});process.stdout.write(r.stdout);process.exit(r.status??1);}console.log(JSON.stringify({status:'ready',version:process.env.DMCT_FIXTURE_MODE==='rollback'&&candidate?'wrong-version':v}));`,
  );
  // The candidate's first health request opens the live database through the
  // same startup path as app/api/health (openDatabase runs pending migrations)
  // and reports ready only when the schema matches the candidate's migrations.
  writeFileSync(
    path.join(root, "lib/fixture-health.mjs"),
    `const repo=${JSON.stringify(path.resolve("."))};let status='unavailable';try{const {openDatabase,currentSchemaVersion,expectedSchemaVersion}=await import(repo+'/db/sqlite.ts');const db=openDatabase(process.env.DM_COMMAND_TABLE_DB_PATH);status=currentSchemaVersion(db)===expectedSchemaVersion()?'ready':'degraded';db.close();}catch(error){console.error(error);}console.log(JSON.stringify({status,version:process.env.DMCT_FIXTURE_MODE==='schema-upgrade-rollback'?'wrong-version':process.argv[2]}));`,
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
  options.prepare?.(root);
  const result = spawnSync("bash", [path.join(root, "updater")], {
    env: {
      ...process.env,
      PATH: root + "/bin:" + process.env.PATH,
      DMCT_FIXTURE_ROOT: root,
      DMCT_FIXTURE_MODE: mode,
      ...options.env,
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
    // The failed build folder is removed; its output is the diagnosis.
    assert.deepEqual(readdirSync(path.join(f.root, "base/builds")), []);
    assert.deepEqual(readdirSync(path.join(f.root, "base/releases")), ["old"]);
    assert.match(f.result.stderr, /temporary build folder was removed/);
  } finally {
    rmSync(f.root, { recursive: true, force: true });
  }
});
test("a successful automatic build backs up data and switches to a verified healthy version", () => {
  const f = fixture("success");
  try {
    assert.equal(f.result.status, 0, f.result.stderr + f.result.stdout);
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

test("the GUI update migrates a schema-3 database on first start and keeps a schema-3 backup", () => {
  const f = fixture("schema-upgrade");
  try {
    assert.equal(f.result.status, 0, f.result.stderr + f.result.stdout);
    assert.notEqual(realpathSync(path.join(f.root, "base/current")), f.old);
    assert.match(f.result.stdout, /Application update completed/);
    const live = path.join(f.root, "data/live.sqlite");
    assert.equal(schemaVersion(live), migrations.at(-1)!.version);
    const db = new DatabaseSync(live, { readOnly: true });
    try {
      assert.deepEqual(
        db
          .prepare(
            "SELECT r.resource_id AS id, s.title FROM search_index_rows r JOIN search_index s ON s.rowid = r.search_rowid",
          )
          .all()
          .map((row) => ({ ...row })),
        [{ id: "player", title: "Shadowheart" }],
      );
      assert.equal(
        db.prepare("SELECT display_name FROM users WHERE id='owner'").get()!
          .display_name,
        "Before update",
      );
    } finally {
      db.close();
    }
    const backup = f.result.stdout.match(/Pre-update backup: (.+)$/m)![1];
    const backupFile = path.join(backup, "dm-command-table.sqlite");
    assert.equal(schemaVersion(backupFile), 3);
  } finally {
    rmSync(f.root, { recursive: true, force: true });
  }
});

test("a failed update after migration restores the schema-3 backup for the prior release", () => {
  const f = fixture("schema-upgrade-rollback");
  try {
    assert.notEqual(f.result.status, 0);
    assert.equal(realpathSync(path.join(f.root, "base/current")), f.old);
    assert.match(f.result.stdout, /@@DONE rollback/);
    assert.equal(
      schemaVersion(path.join(f.root, "data/live.sqlite")),
      migrations.at(-1)!.version,
    );
    const config = readFileSync(path.join(f.root, "environment"), "utf8");
    const restored = config.match(/^DM_COMMAND_TABLE_DB_PATH=(.+)$/m)![1];
    assert.equal(schemaVersion(restored), 3);
  } finally {
    rmSync(f.root, { recursive: true, force: true });
  }
});

test("an update stops with a clear message before stopping the application when disk space is short", () => {
  const f = fixture("success", {
    env: { DMCT_UPDATE_MIN_BUILD_FREE_MB: "999999999" },
  });
  try {
    assert.notEqual(f.result.status, 0);
    assert.match(
      f.result.stderr,
      /Not enough free disk space to build the update: \d+ MiB free on the disk holding .*base\/builds, at least 999999999 MiB needed/,
    );
    assert.match(f.result.stderr, /The running application was not changed/);
    assert.equal(realpathSync(path.join(f.root, "base/current")), f.old);
    assert.throws(() => readFileSync(path.join(f.root, "service.log")));
    assert.deepEqual(readdirSync(path.join(f.root, "base/builds")), []);
  } finally {
    rmSync(f.root, { recursive: true, force: true });
  }
});

test("a successful update removes leftover builds and keeps only the newest releases", () => {
  const f = fixture("success", {
    prepare(root) {
      mkdirSync(path.join(root, "base/builds/update-leftover/source"), {
        recursive: true,
      });
      writeFileSync(
        path.join(root, "base/builds/update-leftover/source/big"),
        "x",
      );
      // Older releases from earlier updates, oldest first.
      ["release-oldest", "release-older", "release-recent"].forEach(
        (name, index) => {
          const folder = path.join(root, "base/releases", name);
          mkdirSync(folder);
          const time = new Date(Date.UTC(2026, 0, 1 + index));
          utimesSync(folder, time, time);
        },
      );
      // The current release is older than all of them but must be kept.
      const old = new Date(Date.UTC(2025, 0, 1));
      utimesSync(path.join(root, "base/releases/old"), old, old);
    },
  });
  try {
    assert.equal(f.result.status, 0, f.result.stderr + f.result.stdout);
    assert.match(f.result.stdout, /Removing leftover build folder/);
    assert.deepEqual(readdirSync(path.join(f.root, "base/builds")), []);
    const current = path.basename(
      realpathSync(path.join(f.root, "base/current")),
    );
    assert.deepEqual(
      readdirSync(path.join(f.root, "base/releases")).sort(),
      [current, "old", "release-recent"].sort(),
    );
    assert.match(f.result.stdout, /Kept the previous release .*releases\/old/);
    // Backups are never removed by the updater.
    assert.equal(readdirSync(path.join(f.root, "data/backups")).length, 1);
  } finally {
    rmSync(f.root, { recursive: true, force: true });
  }
});
