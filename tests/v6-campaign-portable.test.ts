import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { runMigrations } from "../db/migrations.ts";
import { createBestiaryRepository } from "../server/v6/bestiary-repository.ts";
import { createV6CampaignRepository } from "../server/v6/campaign-repository.ts";
import { exportV6Campaign, importV6Campaign } from "../server/v6/campaign-portable.ts";
import { createContentRepository } from "../server/v6/content-repository.ts";
import { createEncounterRepository } from "../server/v6/encounter-repository.ts";

test("portable v6 campaign exports round-trip with remapped relationships", () => {
  const database = new DatabaseSync(":memory:");
  database.exec("PRAGMA foreign_keys = ON");
  runMigrations(database);
  const now = Date.now();
  database.prepare(
    "INSERT INTO users (id,display_name,username,password_hash,is_admin,created_at,updated_at) VALUES ('owner','Owner','owner','hash',1,?,?)",
  ).run(now, now);

  const campaigns = createV6CampaignRepository(database);
  const content = createContentRepository(database);
  const bestiary = createBestiaryRepository(database);
  const encounters = createEncounterRepository(database);
  const campaign = campaigns.create("owner", { name: "Ravenloft", notes: "<p>Fog</p>" });
  const tag = bestiary.createTag(campaign.id, "owner", { name: "Undead", color: "#663399" });
  const monster = bestiary.create(campaign.id, "owner", {
    name: "Strahd", type: "Undead", challengeRating: "15", armorClass: 16,
    hitPoints: 144, speed: "30 ft.", stats: "Legendary", abilities: "Charm",
    spells: "Fireball", notes: "Count", spellSlots: [4, 3, 3], source: "Local",
    favorite: true, tagIds: [tag.id],
  });
  const player = content.createPlayer(campaign.id, "owner", {
    name: "Ireena", race: "Human", className: "Noble", level: 4,
    hitPoints: 24, armorClass: 14, notes: "Protected",
  });
  const session = content.createSession(campaign.id, "owner", {
    title: "The Castle", date: "2026-09-29", notes: "Arrival",
    status: "active", sortOrder: 0,
  });
  encounters.createPrepared(campaign.id, "owner", session.id, {
    name: "Final duel", notes: "At midnight", sortOrder: 0,
    monsters: [{ id: crypto.randomUUID(), monsterId: monster.id, displayNumber: 1, quantity: 1, sortOrder: 0 }],
  });
  content.createStoryBeat(campaign.id, "owner", {
    title: "Confrontation", chapter: "Finale", details: "Face the count",
    status: "active", sortOrder: 0, sessionIds: [session.id],
  });
  const combat = encounters.getCombat(campaign.id, "owner");
  encounters.saveCombat(campaign.id, "owner", combat.revision, {
    name: "Tower", round: 2, turn: 0,
    combatants: [{
      id: crypto.randomUUID(), playerId: player.id, monsterId: null, name: player.name,
      displayNumber: null, kind: "player", notes: "Keep Ireena safe", initiative: 18, hitPoints: 20,
      maximumHitPoints: 24, armorClass: 14, sortOrder: 0, revision: 1,
      conditions: [{ id: crypto.randomUUID(), name: "Blessed", remainingTurns: 3 }],
    }],
  });

  const exported = exportV6Campaign(database, campaign.id, "owner");
  const imported = importV6Campaign(database, "owner", JSON.parse(JSON.stringify(exported)));
  const importedMonsters = bestiary.list(imported.id, "owner");
  const importedPlayers = content.listPlayers(imported.id, "owner");
  const importedSessions = content.listSessions(imported.id, "owner");
  const importedStory = content.listStory(imported.id, "owner");
  const importedCombat = encounters.getCombat(imported.id, "owner");

  assert.equal(imported.name, "Ravenloft — Imported");
  assert.equal(importedMonsters[0]?.tags[0]?.name, "Undead");
  assert.notEqual(importedMonsters[0]?.id, monster.id);
  assert.notEqual(importedPlayers[0]?.id, player.id);
  assert.deepEqual(importedStory[0]?.sessionIds, [importedSessions[0]?.id]);
  const prepared = encounters.listPrepared(imported.id, "owner", importedSessions[0]!.id);
  assert.equal(prepared[0]?.monsters[0]?.monsterId, importedMonsters[0]?.id);
  assert.equal(importedCombat.combatants[0]?.playerId, importedPlayers[0]?.id);
  assert.equal(importedCombat.combatants[0]?.conditions[0]?.remainingTurns, 3);
  database.close();
});
