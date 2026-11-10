import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { runMigrations } from "../db/migrations.ts";
import { createCampaignRepository } from "../server/campaigns/campaign-repository.ts";
import { createContentRepository } from "../server/content/content-repository.ts";
import { RevisionConflictError } from "../server/http/conflicts.ts";

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
  return { database, campaign, content: createContentRepository(database) };
}

test("players and sessions are revisioned resources", () => {
  const { database, campaign, content } = fixture();
  const player = content.createPlayer(campaign.id, "owner", {
    name: "Minsc",
    race: "Human",
    className: "Ranger",
    level: 5,
    hitPoints: 45,
    armorClass: 16,
    notes: "Boo included",
  });
  assert.equal(player.revision, 1);
  const changed = content.updatePlayer(campaign.id, "owner", player.id, 1, {
    ...player,
    level: 6,
  });
  assert.equal(changed.level, 6);
  assert.equal(changed.revision, 2);
  assert.throws(
    () => content.updatePlayer(campaign.id, "owner", player.id, 1, changed),
    RevisionConflictError,
  );

  const session = content.createSession(campaign.id, "owner", {
    title: "Arrival",
    date: "2026-09-28",
    notes: "Notes",
    status: "planned",
    sortOrder: 0,
  });
  assert.deepEqual(content.listSessions(campaign.id, "owner"), [session]);
  database.close();
});

test("story links are deduplicated and constrained to the campaign", () => {
  const { database, campaign, content } = fixture();
  const first = content.createSession(campaign.id, "owner", {
    title: "First",
    date: "2026-09-28",
    notes: "",
    status: "happened",
    sortOrder: 0,
  });
  const second = content.createSession(campaign.id, "owner", {
    title: "Second",
    date: "2026-10-05",
    notes: "",
    status: "planned",
    sortOrder: 1,
  });
  const beat = content.createStoryBeat(campaign.id, "owner", {
    title: "The reveal",
    chapter: "I",
    details: "A secret",
    status: "active",
    sortOrder: 0,
    sessionIds: [first.id, second.id, first.id],
  });
  assert.deepEqual(beat.sessionIds, [first.id, second.id].sort());
  content.deleteSession(campaign.id, "owner", first.id);
  assert.deepEqual(content.listStory(campaign.id, "owner")[0]?.sessionIds, [
    second.id,
  ]);
  database.close();
});

test("story collection reads keep query count constant and links campaign-scoped and ordered", () => {
  const { database, campaign, content } = fixture();
  let reads = 0;
  const prepare = database.prepare.bind(database);
  database.prepare = (sql: string) => {
    const prepared = prepare(sql);
    return new Proxy(prepared, {
      get(target, property) {
        const value = Reflect.get(target, property);
        if (typeof value !== "function") return value;
        return (...args: unknown[]) => {
          if (["all", "get", "iterate"].includes(String(property))) reads++;
          return value.apply(target, args);
        };
      },
    });
  };
  try {
    const session = (title: string) =>
      content.createSession(campaign.id, "owner", {
        title,
        date: "",
        notes: "",
        status: "planned",
        sortOrder: 0,
      });
    const first = session("First"),
      second = session("Second");
    const story = (title: string, sessionIds: string[]) =>
      content.createStoryBeat(campaign.id, "owner", {
        title,
        chapter: "",
        details: "<p>Notes</p>",
        status: "planned",
        sortOrder: 0,
        sessionIds,
      });
    const initial = story("Linked", [second.id, first.id]);
    reads = 0;
    assert.equal(content.listStory(campaign.id, "owner").length, 1);
    const smallReads = reads;
    for (let i = 0; i < 30; i++) story(`Beat ${i}`, i % 2 ? [first.id] : []);
    const other = createCampaignRepository(database).create("owner", {
      name: "Other",
    });
    content.createStoryBeat(other.id, "owner", {
      title: "Other campaign",
      chapter: "",
      details: "",
      status: "planned",
      sortOrder: 0,
      sessionIds: [],
    });
    reads = 0;
    const result = content.listStory(campaign.id, "owner");
    assert.equal(
      reads,
      smallReads,
      "one link query per collection, regardless of story count",
    );
    assert.equal(result.length, 31);
    assert.deepEqual(
      result.find(({ id }) => id === initial.id)?.sessionIds,
      [first.id, second.id].sort(),
    );
    assert.equal(
      result.some(({ title }) => title === "Other campaign"),
      false,
    );
    assert.ok(result.some(({ sessionIds }) => sessionIds.length === 0));
    content.deleteSession(campaign.id, "owner", second.id);
    assert.deepEqual(
      content
        .listStory(campaign.id, "owner")
        .find(({ id }) => id === initial.id)?.sessionIds,
      [first.id],
    );
  } finally {
    database.close();
  }
});
