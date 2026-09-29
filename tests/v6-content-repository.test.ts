import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { runMigrations } from "../db/migrations.ts";
import { createV6CampaignRepository } from "../server/v6/campaign-repository.ts";
import { createContentRepository } from "../server/v6/content-repository.ts";
import { RevisionConflictError } from "../server/v6/conflicts.ts";

function fixture() {
  const database = new DatabaseSync(":memory:");
  database.exec("PRAGMA foreign_keys = ON");
  runMigrations(database);
  const now = Date.now();
  database.prepare(
    `INSERT INTO users
      (id, display_name, username, password_hash, is_admin, created_at, updated_at)
     VALUES ('owner', 'Owner', 'owner', 'hash', 1, ?, ?)`,
  ).run(now, now);
  const campaign = createV6CampaignRepository(database).create("owner", { name: "Campaign" });
  return { database, campaign, content: createContentRepository(database) };
}

test("players and sessions are revisioned resources", () => {
  const { database, campaign, content } = fixture();
  const player = content.createPlayer(campaign.id, "owner", {
    name: "Minsc", race: "Human", className: "Ranger", level: 5,
    hitPoints: 45, armorClass: 16, notes: "Boo included",
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
    title: "Arrival", date: "2026-09-28", notes: "Notes",
    status: "planned", sortOrder: 0,
  });
  assert.deepEqual(content.listSessions(campaign.id, "owner"), [session]);
  database.close();
});

test("story links are deduplicated and constrained to the campaign", () => {
  const { database, campaign, content } = fixture();
  const first = content.createSession(campaign.id, "owner", {
    title: "First", date: "2026-09-28", notes: "", status: "happened", sortOrder: 0,
  });
  const second = content.createSession(campaign.id, "owner", {
    title: "Second", date: "2026-10-05", notes: "", status: "planned", sortOrder: 1,
  });
  const beat = content.createStoryBeat(campaign.id, "owner", {
    title: "The reveal", chapter: "I", details: "A secret", status: "active",
    sortOrder: 0, sessionIds: [first.id, second.id, first.id],
  });
  assert.deepEqual(beat.sessionIds, [first.id, second.id].sort());
  content.deleteSession(campaign.id, "owner", first.id);
  assert.deepEqual(content.listStory(campaign.id, "owner")[0]?.sessionIds, [second.id]);
  database.close();
});

