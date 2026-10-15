import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import {
  mkdtempSync,
  readdirSync,
  rmSync,
  readFileSync,
  writeFileSync,
  unlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { migrations, runMigrations } from "../db/migrations.ts";
import {
  createBestiaryRepository,
  type MonsterInput,
} from "../server/bestiary/bestiary-repository.ts";
import { createCampaignRepository } from "../server/campaigns/campaign-repository.ts";
import { copyCampaign } from "../server/campaigns/campaign-copy.ts";
import {
  exportCampaign,
  importCampaign,
} from "../server/campaigns/campaign-portable.ts";
import {
  saveScreenshot,
  screenshotFile,
  deleteScreenshot,
} from "../server/media/screenshots.ts";
import { RevisionConflictError } from "../server/http/conflicts.ts";
import { handleApi } from "../server/api/api-router.ts";

const goblin: MonsterInput = {
  name: "Goblin",
  type: "Humanoid",
  challengeRating: "1/4",
  armorClass: 15,
  hitPoints: 7,
  speed: "30 ft.",
  stats: "",
  token: "",
  abilities: "<p>Nimble Escape</p>",
  spells: "",
  notes: "",
  spellSlots: [],
  source: "MM",
  favorite: false,
};
function fixture() {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys=ON");
  runMigrations(db);
  db.exec(
    "INSERT INTO users VALUES('owner','Owner','owner','hash',0,1,1),('other','Other','other','hash',0,1,1)",
  );
  const campaigns = createCampaignRepository(db);
  const a = campaigns.create("owner", { name: "A" });
  const b = campaigns.create("owner", { name: "B" });
  return { db, campaigns, a, b, bestiary: createBestiaryRepository(db) };
}
function definition(db: DatabaseSync, id: string): string {
  return db
    .prepare("SELECT definition_id AS id FROM monsters WHERE id=?")
    .get(id)!.id as string;
}
function definitionCount(db: DatabaseSync): number {
  return db.prepare("SELECT COUNT(*) AS n FROM monster_definitions").get()!
    .n as number;
}

test("unchanged imports share definitions; content edits fork permanently while campaign metadata stays independent", () => {
  const { db, a, b, bestiary } = fixture();
  try {
    const one = bestiary.create(a.id, "owner", goblin, true);
    const two = bestiary.create(b.id, "owner", goblin, true);
    assert.notEqual(one.id, two.id);
    assert.equal(definition(db, one.id), definition(db, two.id));
    assert.equal(definitionCount(db), 1);
    const tag = bestiary.createTag(a.id, "owner", { name: "Forest" });
    const favorite = bestiary.update(a.id, "owner", one.id, one.revision, {
      ...goblin,
      favorite: true,
      tagIds: [tag.id],
    });
    assert.equal(definition(db, one.id), definition(db, two.id));
    assert.equal(bestiary.list(b.id, "owner")[0].favorite, false);
    assert.equal(bestiary.list(b.id, "owner")[0].tags.length, 0);
    const changed = bestiary.update(a.id, "owner", one.id, favorite.revision, {
      ...goblin,
      hitPoints: 21,
    });
    assert.equal(changed.id, one.id);
    assert.equal(bestiary.isShared(a.id, "owner", one.id), false);
    assert.notEqual(definition(db, one.id), definition(db, two.id));
    assert.equal(bestiary.list(b.id, "owner")[0].hitPoints, 7);
    const count = definitionCount(db);
    assert.throws(
      () => bestiary.update(a.id, "owner", one.id, 1, goblin),
      RevisionConflictError,
    );
    assert.equal(definitionCount(db), count);
    const reverted = bestiary.update(
      a.id,
      "owner",
      one.id,
      changed.revision,
      goblin,
      true,
    );
    assert.equal(reverted.hitPoints, 7);
    assert.equal(bestiary.isShared(a.id, "owner", one.id), false);
    assert.notEqual(definition(db, one.id), definition(db, two.id));
    const updatedRules = bestiary.create(
      b.id,
      "owner",
      { ...goblin, hitPoints: 9 },
      true,
    );
    assert.notEqual(definition(db, updatedRules.id), definition(db, two.id));
    const unchanged = bestiary.create(a.id, "owner", goblin, true);
    assert.equal(definition(db, unchanged.id), definition(db, two.id));
    assert.throws(
      () => db.prepare("UPDATE monster_definitions SET payload='{}'").run(),
      /immutable/,
    );
    assert.throws(
      () =>
        db
          .prepare("UPDATE monsters SET definition_id=? WHERE id=?")
          .run(definition(db, one.id), two.id),
      /scope/,
    );
    assert.throws(() => bestiary.list(a.id, "other"));
  } finally {
    db.close();
  }
});

test("campaign copies reuse shared definitions but copy private variants; portable imports remain private and deletion is scoped", () => {
  const { db, campaigns, a, b, bestiary } = fixture();
  try {
    const shared = bestiary.create(a.id, "owner", goblin, true);
    const privateMonster = bestiary.create(a.id, "owner", {
      ...goblin,
      name: "Custom",
    });
    const copied = copyCampaign(db, a.id, "owner", "campaign");
    const copies = bestiary.list(copied.id, "owner");
    assert.equal(
      definition(db, copies.find(({ name }) => name === "Goblin")!.id),
      definition(db, shared.id),
    );
    assert.notEqual(
      definition(db, copies.find(({ name }) => name === "Custom")!.id),
      definition(db, privateMonster.id),
    );
    const imported = importCampaign(
      db,
      "owner",
      exportCampaign(db, a.id, "owner"),
    );
    assert.ok(
      bestiary
        .list(imported.id, "owner")
        .every(({ id }) => !bestiary.isShared(imported.id, "owner", id)),
    );
    campaigns.delete(a.id, "owner");
    assert.equal(bestiary.list(copied.id, "owner").length, 2);
    campaigns.delete(copied.id, "owner");
    campaigns.delete(imported.id, "owner");
    campaigns.delete(b.id, "owner");
    assert.equal(definitionCount(db), 0);
    assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
  } finally {
    db.close();
  }
});

test("import reuse is authorized and invalid campaign metadata rolls back new definitions", async () => {
  const { db, a, b, bestiary } = fixture();
  try {
    const post = (campaignId: string, actor: string, extra = {}) =>
      handleApi(
        new Request(`http://local/api/campaigns/${campaignId}/monsters`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ...goblin, catalogueImport: true, ...extra }),
        }),
        db,
        { userId: actor, isAdmin: false },
      );
    assert.equal((await post(a.id, "owner")).status, 201);
    assert.equal((await post(b.id, "owner")).status, 201);
    assert.equal(definitionCount(db), 1);
    assert.equal((await post(a.id, "other")).status, 403);
    assert.equal(
      (await post(a.id, "owner", { catalogueImport: "true" })).status,
      400,
    );
    assert.throws(() =>
      bestiary.create(
        a.id,
        "owner",
        { ...goblin, name: "Failed", tagIds: [crypto.randomUUID()] },
        true,
      ),
    );
    assert.equal(definitionCount(db), 1);
    assert.equal(bestiary.list(a.id, "owner").length, 1);
  } finally {
    db.close();
  }
});

test("schema-2 data migrates without changing campaign IDs, revisions or edited content", () => {
  const db = new DatabaseSync(":memory:");
  try {
    db.exec("PRAGMA foreign_keys=ON");
    for (const migration of migrations.slice(0, 2)) db.exec(migration.sql);
    db.exec(
      "CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY,name TEXT,applied_at INTEGER)",
    );
    for (const migration of migrations.slice(0, 2))
      db.prepare("INSERT INTO schema_migrations VALUES(?,?,1)").run(
        migration.version,
        migration.name,
      );
    db.exec(
      "INSERT INTO users VALUES('owner','Owner','owner','hash',0,1,1); INSERT INTO campaigns(id,owner_id,name,created_at,updated_at) VALUES('a','owner','A',1,1),('b','owner','B',1,1)",
    );
    const insert = db.prepare(
      `INSERT INTO monsters(id,campaign_id,name,type,challenge_rating,armor_class,hit_points,speed,stats,token,abilities,spells,notes,spell_slots,source,favorite,revision,created_at,updated_at) VALUES(?,?,'Goblin','Humanoid','1/4',15,7,'30 ft.','','','<p>Nimble Escape</p>','','','[]','MM',0,?,1,1)`,
    );
    insert.run("one", "a", 1);
    insert.run("two", "b", 1);
    insert.run("edited", "b", 2);
    runMigrations(db);
    runMigrations(db);
    assert.equal(definition(db, "one"), definition(db, "two"));
    assert.notEqual(definition(db, "one"), definition(db, "edited"));
    const bestiary = createBestiaryRepository(db);
    assert.equal(
      bestiary.list("b", "owner").find(({ id }) => id === "edited")!.revision,
      2,
    );
    const fresh = bestiary.create("a", "owner", goblin, true);
    assert.equal(definition(db, fresh.id), definition(db, "one"));
    assert.equal(definitionCount(db), 2);
    assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
  } finally {
    db.close();
  }
});

test("token imports reuse identical encoded bytes including legacy files, protect account isolation and keep references across campaigns", async () => {
  const { db, a, b, bestiary } = fixture();
  const dir = mkdtempSync(path.join(tmpdir(), "dmct-reuse-"));
  const previous = process.env.DM_COMMAND_TABLE_UPLOAD_PATH;
  process.env.DM_COMMAND_TABLE_UPLOAD_PATH = dir;
  try {
    const bytes = await sharp({
      create: { width: 8, height: 8, channels: 3, background: "red" },
    })
      .png()
      .toBuffer();
    const file = () => new File([bytes], "goblin.png", { type: "image/png" });
    const legacy = await saveScreenshot(db, file(), "owner");
    assert.equal(
      db
        .prepare("SELECT content_hash FROM screenshots WHERE id=?")
        .get(legacy.id)!.content_hash,
      null,
    );
    // A legacy token may sit behind many equally-sized but different images.
    const originalBytes = readFileSync(path.join(dir, `${legacy.id}.webp`));
    const candidates: string[] = [];
    for (let i = 0; i < 65; i++) {
      const id = crypto.randomUUID();
      candidates.push(id);
      const different = Buffer.from(originalBytes);
      different[different.length - 1] ^= i + 1;
      writeFileSync(path.join(dir, `${id}.webp`), different);
      db.prepare(
        "INSERT INTO screenshots(id,filename,original_name,mime_type,size,uploaded_by,created_at) VALUES(?,?,?,'image/webp',?,'owner',0)",
      ).run(id, `${id}.webp`, "legacy", different.length);
    }
    const reused = await saveScreenshot(db, file(), "owner", true);
    for (const id of candidates) {
      db.prepare("DELETE FROM screenshots WHERE id=?").run(id);
      unlinkSync(path.join(dir, `${id}.webp`));
    }
    assert.equal(reused.id, legacy.id);
    const again = await saveScreenshot(db, file(), "owner", true);
    assert.equal(again.id, legacy.id);
    assert.equal(readdirSync(dir).length, 1);
    assert.equal(screenshotFile(db, legacy.id, "other", false), null);
    db.exec(
      "INSERT INTO application_settings VALUES('server.screenshot_quota_mb','1',1),('server.screenshot_global_quota_mb','1',1)",
    );
    db.prepare(
      "INSERT INTO screenshots(id,filename,original_name,mime_type,size,uploaded_by,created_at) VALUES('quota','quota.webp','quota','image/webp',1048576,'owner',1)",
    ).run();
    assert.equal(
      (await saveScreenshot(db, file(), "owner", true)).id,
      legacy.id,
    );
    const blue = await sharp({
      create: { width: 8, height: 8, channels: 3, background: "blue" },
    })
      .png()
      .toBuffer();
    await assert.rejects(
      () =>
        saveScreenshot(
          db,
          new File([blue], "new.png", { type: "image/png" }),
          "owner",
          true,
        ),
      /quota/,
    );
    assert.equal(readdirSync(dir).length, 1);
    db.exec(
      "DELETE FROM screenshots WHERE id='quota'; DELETE FROM application_settings WHERE key IN ('server.screenshot_quota_mb','server.screenshot_global_quota_mb')",
    );
    const other = await saveScreenshot(db, file(), "other", true);
    assert.notEqual(other.id, legacy.id);
    assert.equal(screenshotFile(db, legacy.id, "other", false), null);
    const input = {
      ...goblin,
      token: `<img src="${reused.url}" alt="Monster token" />`,
    };
    const first = bestiary.create(a.id, "owner", input, true);
    const second = bestiary.create(b.id, "owner", input, true);
    assert.equal(definition(db, first.id), definition(db, second.id));
    bestiary.delete(a.id, "owner", first.id);
    assert.equal(
      await deleteScreenshot(db, legacy.id, "owner", false),
      "referenced",
    );
    assert.ok(screenshotFile(db, legacy.id, "owner", false));
    bestiary.delete(b.id, "owner", second.id);
    assert.equal(
      await deleteScreenshot(db, legacy.id, "owner", false),
      "deleted",
    );
    const green = await sharp({
      create: { width: 8, height: 8, channels: 3, background: "green" },
    })
      .png()
      .toBuffer();
    const concurrent = await Promise.all(
      [1, 2].map(() =>
        saveScreenshot(
          db,
          new File([green], "new.png", { type: "image/png" }),
          "owner",
          true,
        ),
      ),
    );
    assert.equal(concurrent[0].id, concurrent[1].id);
    assert.equal(readdirSync(dir).length, 2);
  } finally {
    if (previous === undefined) delete process.env.DM_COMMAND_TABLE_UPLOAD_PATH;
    else process.env.DM_COMMAND_TABLE_UPLOAD_PATH = previous;
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
