import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { runMigrations } from "../db/migrations.ts";
import { createV6CampaignRepository } from "../server/v6/campaign-repository.ts";
import {
  createBestiaryRepository,
  type MonsterInput,
} from "../server/v6/bestiary-repository.ts";
import { RevisionConflictError } from "../server/v6/conflicts.ts";

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
  const campaign = createV6CampaignRepository(database).create("owner", {
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
