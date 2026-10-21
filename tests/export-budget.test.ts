import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, rmSync, writeFileSync, truncateSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { runMigrations } from "../db/migrations.ts";
import { createCampaignRepository } from "../server/campaigns/campaign-repository.ts";
import { createBestiaryRepository } from "../server/bestiary/bestiary-repository.ts";
import { assertCampaignExportBudget } from "../server/campaigns/export-budget.ts";
import { exportCampaign } from "../server/campaigns/campaign-portable.ts";
import { exportCampaignPackage } from "../server/campaigns/campaign-package.ts";
import { monsterPayload } from "../server/bestiary/monster-definitions.ts";
import { readScreenshot } from "../server/media/screenshots.ts";

const monster = {
  name: "Goblin",
  type: "Humanoid",
  challengeRating: "0",
  hitPoints: 7,
  armorClass: 10,
  speed: "",
  stats: "",
  token: "",
  abilities: "",
  spells: "",
  notes: "",
  spellSlots: [],
  source: "MM",
  favorite: false,
};
function fixture(filename = ":memory:") {
  const db = new DatabaseSync(filename);
  db.exec("PRAGMA foreign_keys=ON");
  runMigrations(db);
  db.exec("INSERT INTO users VALUES('owner','Owner','owner','hash',0,1,1)");
  const campaign = createCampaignRepository(db).create("owner", {
    name: "Export assessment",
  });
  return { db, campaign };
}
const tooLarge = (error: unknown) =>
  error instanceof Error && "status" in error && error.status === 413;
function seedMonsters(
  db: DatabaseSync,
  campaignId: string,
  count: number,
  abilities: string,
  shared = false,
) {
  const payload = monsterPayload({ ...monster, abilities });
  const definition = db.prepare(
    "INSERT INTO monster_definitions(id,scope_campaign_id,payload,content_hash) VALUES(?,?,?,?)",
  );
  const entry = db.prepare(
    "INSERT INTO monsters(id,campaign_id,name,definition_id,created_at,updated_at) VALUES(?,?,?,?,1,1)",
  );
  const sharedId = crypto.randomUUID();
  if (shared) definition.run(sharedId, null, payload, sharedId);
  db.exec("BEGIN");
  for (let i = 0; i < count; i++) {
    const id = crypto.randomUUID();
    if (!shared) definition.run(id, campaignId, payload, id);
    entry.run(id, campaignId, monster.name, shared ? sharedId : id);
  }
  db.exec("COMMIT");
}

test("oversized raw/package exports reject within a constrained heap before materializing campaign content", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "dmct-export-budget-"));
  const filename = path.join(dir, "test.sqlite");
  const { db, campaign } = fixture(filename);
  try {
    seedMonsters(db, campaign.id, 85, "A".repeat(900000));
    db.close();
    const portable = pathToFileURL(
      path.resolve("server/campaigns/campaign-portable.ts"),
    ).href;
    const packaged = pathToFileURL(
      path.resolve("server/campaigns/campaign-package.ts"),
    ).href;
    const code = `import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';import {exportCampaign} from ${JSON.stringify(portable)};import {exportCampaignPackage} from ${JSON.stringify(packaged)};const db=new DatabaseSync(process.argv[1]);const id=process.argv[2];assert.throws(()=>exportCampaign(db,id,'owner'),e=>e.status===413);await assert.rejects(()=>exportCampaignPackage(db,id,'owner'),e=>e.status===413);db.prepare('DELETE FROM monsters WHERE id IN (SELECT id FROM monsters WHERE campaign_id=? LIMIT 55)').run(id);assert.throws(()=>exportCampaign(db,id,'owner'),e=>e.status===413);await assert.rejects(()=>exportCampaignPackage(db,id,'owner'),e=>e.status===413);db.prepare('DELETE FROM monsters WHERE campaign_id=?').run(id);assert.equal(exportCampaign(db,id,'owner').campaign.name,'Export assessment');assert.equal((await exportCampaignPackage(db,id,'owner')).assets.length,0);db.close();console.log('both exports rejected safely; normal exports passed');`;
    const result = spawnSync(
      process.execPath,
      [
        "--max-old-space-size=128",
        "--max-semi-space-size=16",
        "--experimental-strip-types",
        "--input-type=module",
        "-e",
        code,
        filename,
        campaign.id,
      ],
      { encoding: "utf8", timeout: 30000 },
    );
    assert.equal(result.signal, null, result.stderr);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /normal exports passed/);
  } finally {
    if (db.isOpen) db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("export budget counts repeated shared payloads and JSON escaping", () => {
  for (const [count, text, shared] of [
    [85, "A".repeat(900000), true],
    [11, "\u0000".repeat(900000), false],
  ] as const) {
    const { db, campaign } = fixture();
    try {
      seedMonsters(db, campaign.id, count, text, shared);
      assert.throws(
        () => assertCampaignExportBudget(db, campaign.id, "owner"),
        tooLarge,
      );
    } finally {
      db.close();
    }
  }
});

test("export budget includes UTF-8 prepared notes and combat snapshot/runtime JSON", () => {
  for (const mode of ["prepared", "snapshot", "runtime"]) {
    const { db, campaign } = fixture();
    try {
      if (mode === "prepared") {
        const session = crypto.randomUUID();
        db.prepare(
          "INSERT INTO sessions(id,campaign_id,title,created_at,updated_at) VALUES(?,?,'Session',1,1)",
        ).run(session, campaign.id);
        const insert = db.prepare(
          "INSERT INTO prepared_encounters(id,session_id,name,notes,created_at,updated_at) VALUES(?,?,'Prepared',?,1,1)",
        );
        for (let i = 0; i < 22; i++)
          insert.run(crypto.randomUUID(), session, "界".repeat(900000));
      } else {
        const combat = crypto.randomUUID();
        db.prepare(
          "INSERT INTO combat_encounters(id,campaign_id,created_at,updated_at) VALUES(?,?,1,1)",
        ).run(combat, campaign.id);
        const snapshot = JSON.stringify({
          ...monster,
          abilities: "A".repeat(900000),
        });
        const runtime = JSON.stringify({ concentration: "A".repeat(900000) });
        const insert = db.prepare(
          "INSERT INTO combatants(id,encounter_id,name,kind,snapshot,runtime,created_at,updated_at) VALUES(?,?,'Monster','monster',?,?,1,1)",
        );
        for (let i = 0; i < 64; i++)
          insert.run(
            crypto.randomUUID(),
            combat,
            mode === "snapshot" ? snapshot : null,
            mode === "runtime" ? runtime : "{}",
          );
      }
      assert.throws(
        () => assertCampaignExportBudget(db, campaign.id, "owner"),
        tooLarge,
      );
    } finally {
      db.close();
    }
  }
});

test("export checks access before inspecting campaign content and ordinary exports still work", () => {
  const { db, campaign } = fixture();
  try {
    createBestiaryRepository(db).create(campaign.id, "owner", monster, true);
    assert.throws(
      () => exportCampaign(db, campaign.id, "other"),
      (e) => e instanceof Error && "status" in e && e.status === 404,
    );
    assert.equal(exportCampaign(db, campaign.id, "owner").monsters.length, 1);
  } finally {
    db.close();
  }
});

test("package asset reads enforce actual file size before allocation and retain legitimate reads", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "dmct-export-asset-"));
  const previous = process.env.DM_COMMAND_TABLE_UPLOAD_PATH;
  process.env.DM_COMMAND_TABLE_UPLOAD_PATH = dir;
  const { db, campaign } = fixture();
  try {
    const id = crypto.randomUUID(),
      filename = path.join(dir, `${id}.webp`);
    writeFileSync(filename, Buffer.from("abcdef"));
    db.prepare(
      "INSERT INTO screenshots(id,filename,original_name,mime_type,size,uploaded_by,created_at) VALUES(?,?,?,'image/webp',1,'owner',1)",
    ).run(id, `${id}.webp`, "Token");
    assert.equal(
      (await readScreenshot(db, id, "owner", false, 6))!.bytes.toString(),
      "abcdef",
    );
    await assert.rejects(
      () => readScreenshot(db, id, "owner", false, 5),
      tooLarge,
    );
    createBestiaryRepository(db).create(campaign.id, "owner", {
      ...monster,
      token: `<img src="/api/screenshots/${id}" />`,
    });
    truncateSync(filename, 60 * 1024 * 1024);
    await assert.rejects(
      () => exportCampaignPackage(db, campaign.id, "owner"),
      tooLarge,
    );
  } finally {
    db.close();
    if (previous === undefined) delete process.env.DM_COMMAND_TABLE_UPLOAD_PATH;
    else process.env.DM_COMMAND_TABLE_UPLOAD_PATH = previous;
    rmSync(dir, { recursive: true, force: true });
  }
});
