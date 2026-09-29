import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { runMigrations } from "../db/migrations.ts";
import { createV6CampaignRepository } from "../server/v6/campaign-repository.ts";
import { createContentRepository } from "../server/v6/content-repository.ts";
import { createBestiaryRepository } from "../server/v6/bestiary-repository.ts";
import { createEncounterRepository, type V6Combatant } from "../server/v6/encounter-repository.ts";

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
  return {
    database,
    campaign,
    content: createContentRepository(database),
    bestiary: createBestiaryRepository(database),
    encounters: createEncounterRepository(database),
  };
}

test("prepared encounters retain multiple numbered monsters", () => {
  const { database, campaign, content, bestiary, encounters } = fixture();
  const session = content.createSession(campaign.id, "owner", {
    title: "Ambush", date: "2026-09-28", notes: "", status: "planned", sortOrder: 0,
  });
  const monster = bestiary.create(campaign.id, "owner", {
    name: "Goblin", type: "Humanoid", challengeRating: "1/4", armorClass: 15,
    hitPoints: 7, speed: "30 ft.", stats: "", abilities: "", spells: "",
    notes: "", spellSlots: [], source: "MM", favorite: false,
  });
  const prepared = encounters.createPrepared(campaign.id, "owner", session.id, {
    name: "Road ambush", notes: "", sortOrder: 0,
    monsters: [1, 2].map((displayNumber, sortOrder) => ({
      id: crypto.randomUUID(), monsterId: monster.id, displayNumber,
      quantity: 1, sortOrder,
    })),
  });
  assert.deepEqual(prepared.monsters.map(({ displayNumber }) => displayNumber), [1, 2]);
  database.close();
});

test("combat saves history, prevents duplicate linked players, and supports undo", () => {
  const { database, campaign, content, encounters } = fixture();
  const player = content.createPlayer(campaign.id, "owner", {
    name: "Karlach", race: "Tiefling", className: "Barbarian", level: 6,
    hitPoints: 65, armorClass: 15, notes: "",
  });
  const combatant: V6Combatant = {
    id: crypto.randomUUID(), playerId: player.id, monsterId: null, name: player.name,
    displayNumber: null, kind: "player", initiative: 18, hitPoints: 65,
    maximumHitPoints: 65, armorClass: 15, sortOrder: 0, revision: 1,
    conditions: [{ id: crypto.randomUUID(), name: "Blessed", remainingTurns: 2 }],
  };
  const initial = encounters.getCombat(campaign.id, "owner");
  const saved = encounters.saveCombat(campaign.id, "owner", initial.revision, {
    name: "Bridge", round: 1, turn: 0, combatants: [combatant],
  }, "combatant_added");
  assert.equal(saved.combatants[0]?.conditions[0]?.remainingTurns, 2);
  assert.throws(() => encounters.saveCombat(campaign.id, "owner", saved.revision, {
    ...saved, combatants: [combatant, { ...combatant, id: crypto.randomUUID() }],
  }));
  const undone = encounters.undoCombat(campaign.id, "owner");
  assert.equal(undone.combatants.length, 0);
  database.close();
});

