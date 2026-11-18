import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  readdirSync,
  existsSync,
  rmSync,
  utimesSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { runMigrations } from "../db/migrations.ts";
import { runMaintenance } from "../scripts/maintenance.mjs";

function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), "dmct-maintenance-"));
  const databasePath = path.join(root, "data.sqlite"),
    uploads = path.join(root, "uploads"),
    now = Date.now();
  mkdirSync(uploads);
  const db = new DatabaseSync(databasePath);
  runMigrations(db);
  db.exec(`INSERT INTO users(id,display_name,username,password_hash,is_admin,created_at,updated_at) VALUES('owner','Owner','owner','hash',1,1,1);
  INSERT INTO campaigns(id,owner_id,name,notes,created_at,updated_at) VALUES('campaign','owner','Campaign','',1,1);
  INSERT INTO combat_encounters(id,campaign_id,name,round,turn,created_at,updated_at) VALUES('combat','campaign','Combat',1,0,1,1);`);
  const screenshot = (owner: string | null, staging = 0, createdAt = now) => {
    const id = crypto.randomUUID(),
      filename = id + ".webp";
    db.prepare(
      "INSERT INTO screenshots(id,filename,original_name,mime_type,size,uploaded_by,staging,created_at) VALUES(?,?,?,'image/webp',4,?,?,?)",
    ).run(id, filename, filename, owner, staging, createdAt);
    writeFileSync(path.join(uploads, filename), "live");
    return { id, filename };
  };
  return {
    root,
    databasePath,
    uploads,
    now,
    db,
    screenshot,
    close() {
      db.close();
      rmSync(root, { recursive: true, force: true });
    },
  };
}

test("maintenance preserves campaign/undo media, active uploads and existing quarantine while removing expired state", () => {
  const f = fixture();
  try {
    const orphan = f.screenshot(null),
      referenced = f.screenshot(null),
      undo = f.screenshot(null);
    const staging = f.screenshot("owner", 1, f.now - 25 * 60 * 60 * 1000);
    const recent = f.screenshot("owner", 1),
      owned = f.screenshot("owner");
    f.db
      .prepare(
        "INSERT INTO screenshot_references VALUES(?,'campaign','campaign','campaign',?)",
      )
      .run(referenced.id, f.now);
    f.db
      .prepare(
        "INSERT INTO combat_history(encounter_id,action,before_state,created_at) VALUES('combat','save',?,?)",
      )
      .run(JSON.stringify({ notes: undo.id }), f.now);
    const unmatched = crypto.randomUUID() + ".webp";
    writeFileSync(path.join(f.uploads, unmatched), "old");
    const old = new Date(f.now - 25 * 60 * 60 * 1000);
    utimesSync(path.join(f.uploads, unmatched), old, old);
    const quarantine = path.join(f.root, "media-quarantine");
    mkdirSync(quarantine);
    writeFileSync(path.join(quarantine, orphan.filename), "prior quarantine");
    f.db
      .prepare("INSERT INTO local_sessions VALUES('expired','owner',?,?)")
      .run(f.now - 1, f.now - 100);
    f.db
      .prepare("INSERT INTO local_sessions VALUES('valid','owner',?,?)")
      .run(f.now + 100000, f.now);
    f.db
      .prepare("INSERT INTO security_rate_limits VALUES('expired',1,?,?)")
      .run(f.now - 1, f.now);
    f.db
      .prepare("INSERT INTO security_rate_limits VALUES('valid',1,?,?)")
      .run(f.now + 100000, f.now);
    assert.deepEqual(runMaintenance(f), { quarantined: 3 });
    assert.equal(
      readFileSync(path.join(quarantine, orphan.filename), "utf8"),
      "prior quarantine",
    );
    assert.equal(readdirSync(quarantine).length, 4);
    assert.equal(
      readdirSync(quarantine)
        .map((name) => readFileSync(path.join(quarantine, name), "utf8"))
        .filter((text) => text === "live").length,
      2,
    );
    for (const item of [referenced, undo, recent, owned])
      assert.equal(existsSync(path.join(f.uploads, item.filename)), true);
    for (const item of [orphan, staging])
      assert.equal(
        f.db.prepare("SELECT id FROM screenshots WHERE id=?").get(item.id),
        undefined,
      );
    assert.deepEqual(
      f.db
        .prepare("SELECT token_hash FROM local_sessions")
        .all()
        .map((r) => r.token_hash),
      ["valid"],
    );
    assert.deepEqual(
      f.db
        .prepare("SELECT key FROM security_rate_limits")
        .all()
        .map((r) => r.key),
      ["valid"],
    );
    assert.deepEqual(runMaintenance(f), { quarantined: 0 });
  } finally {
    f.close();
  }
});

test("maintenance restores moved files and rows when a later deletion fails", () => {
  const f = fixture();
  try {
    const first = f.screenshot(null);
    f.screenshot(null);
    f.db.exec(
      "CREATE TRIGGER reject_cleanup BEFORE DELETE ON screenshots WHEN (SELECT COUNT(*) FROM screenshots)=1 BEGIN SELECT RAISE(ABORT,'injected deletion failure'); END;",
    );
    assert.throws(() => runMaintenance(f), /injected deletion failure/);
    assert.equal(
      f.db.prepare("SELECT COUNT(*) AS n FROM screenshots").get()?.n,
      2,
    );
    assert.equal(
      readFileSync(path.join(f.uploads, first.filename), "utf8"),
      "live",
    );
    assert.equal(readdirSync(f.uploads).length, 2);
    assert.equal(readdirSync(path.join(f.root, "media-quarantine")).length, 0);
  } finally {
    f.close();
  }
});

test("maintenance refuses a missing database without creating one", () => {
  const root = mkdtempSync(path.join(tmpdir(), "dmct-maintenance-missing-"));
  try {
    const databasePath = path.join(root, "missing.sqlite");
    assert.throws(
      () =>
        runMaintenance({ databasePath, uploads: path.join(root, "uploads") }),
      /ENOENT/,
    );
    assert.equal(existsSync(databasePath), false);
    assert.equal(existsSync(path.join(root, "uploads")), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
