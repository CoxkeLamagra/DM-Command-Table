import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { runMigrations } from "../db/migrations.ts";
import { createCampaignRepository } from "../server/campaigns/campaign-repository.ts";
import {
  createBestiaryRepository,
  type MonsterInput,
} from "../server/bestiary/bestiary-repository.ts";
import { RevisionConflictError } from "../server/http/conflicts.ts";

const goblin: MonsterInput = {
  name: "Goblin",
  type: "Humanoid",
  challengeRating: "1/4",
  armorClass: 15,
  hitPoints: 7,
  speed: "30 ft.",
  stats: "10 14 10 10 8 8",
  abilities: "Nimble Escape",
  spells: "",
  notes: "",
  spellSlots: [],
  source: "MM",
  favorite: false,
};

function fixture() {
  const database = new DatabaseSync(":memory:");
  database.exec("PRAGMA foreign_keys = ON");
  runMigrations(database);
  const now = Date.now();
  database
    .prepare(
      `INSERT INTO users
      (id, display_name, username, password_hash, is_admin, created_at, updated_at)
     VALUES ('owner', 'Owner', 'owner', 'hash', 1, ?, ?)`,
    )
    .run(now, now);
  const campaign = createCampaignRepository(database).create("owner", {
    name: "Campaign",
  });
  return { database, campaign, bestiary: createBestiaryRepository(database) };
}

test("bestiary monsters support tags, favorites, and revision conflicts", () => {
  const { database, campaign, bestiary } = fixture();
  const tag = bestiary.createTag(campaign.id, "owner", {
    name: "Forest",
    color: "#228b22",
  });
  const monster = bestiary.create(campaign.id, "owner", {
    ...goblin,
    tagIds: [tag.id, tag.id],
  });
  assert.equal(monster.tags.length, 1);
  assert.equal(monster.favorite, false);
  const changed = bestiary.update(campaign.id, "owner", monster.id, 1, {
    ...goblin,
    favorite: true,
    tagIds: [tag.id],
  });
  assert.equal(changed.favorite, true);
  assert.equal(changed.revision, 2);
  assert.throws(
    () => bestiary.update(campaign.id, "owner", monster.id, 1, goblin),
    RevisionConflictError,
  );
  database.close();
});

test("monster bulk deletion succeeds when unlinked and rolls back referenced selections", async () => {
  const { database, campaign, bestiary } = fixture();
  const { handleApi } = await import("../server/api/api-router.ts");
  const { createContentRepository } =
    await import("../server/content/content-repository.ts");
  const { createEncounterRepository } =
    await import("../server/encounters/encounter-repository.ts");
  const deleteIds = (ids: string[]) =>
    handleApi(
      new Request(
        `http://local/api/campaigns/${campaign.id}/monsters/bulk-delete`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ids }),
        },
      ),
      database,
      { userId: "owner", isAdmin: true },
    );
  try {
    const unused = bestiary.create(campaign.id, "owner", goblin);
    assert.equal((await deleteIds([unused.id])).status, 200);
    assert.equal(bestiary.list(campaign.id, "owner").length, 0);
    const free = bestiary.create(campaign.id, "owner", goblin);
    const linked = bestiary.create(campaign.id, "owner", {
      ...goblin,
      name: "Linked",
    });
    const content = createContentRepository(database);
    const session = content.createSession(campaign.id, "owner", {
      title: "Session",
      date: "",
      status: "planned",
      notes: "",
      sortOrder: 0,
    });
    database
      .prepare(
        "INSERT INTO prepared_encounters(id,session_id,name,created_at,updated_at) VALUES('prepared',?,'Encounter',1,1)",
      )
      .run(session.id);
    database
      .prepare(
        "INSERT INTO prepared_encounter_monsters(id,encounter_id,monster_id) VALUES('entry','prepared',?)",
      )
      .run(linked.id);
    const blocked = await deleteIds([free.id, linked.id]);
    assert.equal(blocked.status, 409);
    const body = await blocked.json();
    assert.match(body.error, /Remove it from all prepared encounters/);
    assert.equal(body.code, undefined);
    assert.equal(bestiary.list(campaign.id, "owner").length, 2);
    createEncounterRepository(database).deletePrepared(
      campaign.id,
      "owner",
      "prepared",
    );
    assert.equal((await deleteIds([free.id, linked.id])).status, 200);
    assert.equal(bestiary.list(campaign.id, "owner").length, 0);
  } finally {
    database.close();
  }
});

test("separate Bestiary tokens persist and retain media access when actions change", () => {
  const { database, campaign, bestiary } = fixture();
  try {
    const id = crypto.randomUUID();
    database
      .prepare(
        "INSERT INTO screenshots(id,filename,original_name,mime_type,size,uploaded_by,created_at) VALUES(?,?,?,'image/webp',10,'owner',1)",
      )
      .run(id, id + ".webp", "Goblin");
    const token = `<img src="/api/screenshots/${id}" alt="Monster token" />`;
    const created = bestiary.create(campaign.id, "owner", { ...goblin, token });
    assert.equal(created.token, token);
    assert.equal(created.abilities, goblin.abilities);
    const updated = bestiary.update(
      campaign.id,
      "owner",
      created.id,
      created.revision,
      { ...goblin, token: created.token, abilities: "Edited attack" },
    );
    assert.equal(updated.token, token);
    assert.equal(updated.abilities, "Edited attack");
    const refs = database
      .prepare(
        "SELECT COUNT(*) AS n FROM screenshot_references WHERE screenshot_id=? AND resource_id=?",
      )
      .get(id, created.id) as { n: number };
    assert.equal(refs.n, 1);
  } finally {
    database.close();
  }
});

test("Bestiary list batches tags across monsters and sanitizes at persistence boundary", () => {
  const { database, campaign, bestiary } = fixture();
  let tagReads = 0;
  const prepare = database.prepare.bind(database);
  database.prepare = (sql) => {
    const prepared = prepare(sql);
    return new Proxy(prepared, {
      get(target, property) {
        const member = Reflect.get(target, property);
        if (property === "all" && sql.includes("monster_tags"))
          return (...args: Parameters<typeof prepared.all>) => {
            tagReads++;
            return prepared.all(...args);
          };
        return typeof member === "function" ? member.bind(target) : member;
      },
    });
  };
  try {
    const tag = bestiary.createTag(campaign.id, "owner", { name: "Forest" });
    for (let i = 0; i < 10; i++)
      bestiary.create(campaign.id, "owner", {
        ...goblin,
        name: `Goblin ${i}`,
        tagIds: [tag.id],
      });
    tagReads = 0;
    const listed = bestiary.list(campaign.id, "owner");
    assert.equal(listed.length, 10);
    assert.ok(listed.every((monster) => monster.tags[0].id === tag.id));
    assert.equal(tagReads, 1);
    const dirty = {
      ...goblin,
      stats: "<b>STR 10</b><script>bad()</script>",
      abilities: '<b>Claw</b><img src="https://evil.example/image.png">',
    };
    const clean = bestiary.create(campaign.id, "owner", dirty);
    assert.equal(clean.stats, "<b>STR 10</b>");
    assert.equal(clean.abilities, "<b>Claw</b>");
    assert.match(dirty.stats, /script/);
  } finally {
    database.close();
  }
});
