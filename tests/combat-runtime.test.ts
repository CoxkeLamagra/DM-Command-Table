import { combatantSummary } from "../features/combat/combatant-summary.ts";
import type { Player } from "../domain/types.ts";
import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { runMigrations } from "../db/migrations.ts";
import { emptyRuntime, applyHitPointChange } from "../domain/combat-runtime.ts";
import {
  applyCombatAction,
  loadPreparation,
  CombatCapacityError,
} from "../domain/combat.ts";
import type {
  Combatant,
  CombatEncounter,
  PreparedEncounter,
} from "../domain/encounters.ts";
import { combatRuntimeSchema } from "../server/http/schemas.ts";
import { createCampaignRepository } from "../server/campaigns/campaign-repository.ts";
import { createBestiaryRepository } from "../server/bestiary/bestiary-repository.ts";
import { createEncounterRepository } from "../server/encounters/encounter-repository.ts";
import {
  exportCampaign,
  importCampaign,
} from "../server/campaigns/campaign-portable.ts";
function entry(initiative = 20): Combatant {
  return {
    id: crypto.randomUUID(),
    playerId: null,
    monsterId: null,
    name: "Hero",
    displayNumber: null,
    kind: "player",
    notes: "",
    initiative,
    hitPoints: 10,
    maximumHitPoints: 20,
    armorClass: 15,
    sortOrder: 0,
    conditions: [],
    revision: 1,
    runtime: emptyRuntime(),
  };
}
function combat(entries: Combatant[]): CombatEncounter {
  return {
    id: crypto.randomUUID(),
    campaignId: crypto.randomUUID(),
    name: "Battle",
    round: 1,
    turn: 0,
    combatants: entries,
    revision: 1,
    createdAt: "",
    updatedAt: "",
  };
}
test("damage absorbs temporary HP, healing respects maximum and clears death saves without clearing concentration", () => {
  const hero = entry();
  hero.runtime = {
    ...emptyRuntime(),
    temporaryHitPoints: 5,
    concentration: "Bless",
    deathSaves: { successes: 1, failures: 2 },
  };
  const blocked = applyHitPointChange(hero, 3, "damage");
  assert.equal(blocked.hitPoints, 10);
  assert.equal(blocked.runtime?.temporaryHitPoints, 2);
  const damaged = applyHitPointChange(hero, 8, "damage");
  assert.equal(damaged.hitPoints, 7);
  assert.equal(damaged.runtime?.temporaryHitPoints, 0);
  const healed = applyHitPointChange({ ...hero, hitPoints: 0 }, 100, "heal");
  assert.equal(healed.hitPoints, 20);
  assert.equal(healed.runtime?.temporaryHitPoints, 5);
  assert.deepEqual(healed.runtime?.deathSaves, { successes: 0, failures: 0 });
  assert.equal(healed.runtime?.concentration, "Bless");
  assert.equal(hero.runtime.temporaryHitPoints, 5);
  assert.throws(() => applyHitPointChange(hero, NaN, "damage"));
});
test("turn boundaries expire outgoing/end and incoming/start conditions, retain save-gated effects and reset own-turn resources", () => {
  const outgoing = entry(20),
    incoming = entry(10);
  outgoing.conditions = [
    { id: "end", name: "End", remainingTurns: 1, timing: "end-turn" },
    { id: "manual", name: "Manual", remainingTurns: null, timing: "manual" },
  ];
  incoming.conditions = [
    { id: "start", name: "Start", remainingTurns: 2, timing: "start-turn" },
    {
      id: "save",
      name: "Save",
      remainingTurns: 1,
      timing: "start-turn",
      requiresSave: true,
    },
  ];
  incoming.runtime!.resources = [
    {
      id: crypto.randomUUID(),
      name: "Legendary",
      maximum: 3,
      remaining: 0,
      reset: "start-turn",
    },
    {
      id: crypto.randomUUID(),
      name: "Resistance",
      maximum: 3,
      remaining: 1,
      reset: "manual",
    },
  ];
  const next = applyCombatAction(combat([outgoing, incoming]), "next-turn");
  assert.deepEqual(
    next.combatants[0].conditions.map((value) => value.id),
    ["manual"],
  );
  assert.equal(next.combatants[1].conditions[0].remainingTurns, 1);
  assert.equal(next.combatants[1].conditions[1].saveDue, true);
  assert.equal(next.combatants[1].conditions[1].remainingTurns, null);
  assert.deepEqual(
    next.combatants[1].runtime!.resources.map((value) => value.remaining),
    [3, 1],
  );
  assert.equal(incoming.runtime!.resources[0].remaining, 0);
  assert.equal(outgoing.conditions.length, 2);
  const reset = applyCombatAction(next, "reset-rounds");
  assert.deepEqual(reset.combatants, next.combatants);
  const single = applyCombatAction(combat([outgoing]), "next-turn");
  assert.equal(single.round, 2);
  assert.equal(single.combatants[0].conditions.length, 1);
});
test("prepared monster copies capture independent snapshots/resources and replace the entire previous roster", () => {
  const hero = entry();
  hero.runtime!.temporaryHitPoints = 4;
  const prepared: PreparedEncounter = {
    id: crypto.randomUUID(),
    sessionId: crypto.randomUUID(),
    name: "Wizards",
    notes: "",
    sortOrder: 0,
    monsters: [
      {
        id: crypto.randomUUID(),
        monsterId: "wizard",
        quantity: 2,
        displayNumber: 1,
        sortOrder: 0,
      },
    ],
    revision: 1,
    createdAt: "",
    updatedAt: "",
  };
  const result = loadPreparation(combat([hero]), prepared, [
    {
      id: "wizard",
      name: "Wizard",
      hitPoints: 30,
      armorClass: 12,
      abilities: "Fire",
      spellSlots: [4, 3],
    },
  ]);
  const wizards = result.combatants.filter((value) => value.kind === "monster");
  assert.equal(wizards[0].snapshot?.abilities, "Fire");
  wizards[0].runtime!.resources[0].remaining = 0;
  wizards[0].snapshot!.spellSlots[0] = 0;
  assert.equal(wizards[1].runtime!.resources[0].remaining, 4);
  assert.equal(wizards[1].snapshot!.spellSlots[0], 4);
  assert.equal(result.combatants.length, 2);
  assert.equal(
    result.combatants.some((value) => value.id === hero.id),
    false,
  );
  assert.equal(hero.runtime!.temporaryHitPoints, 4);
});
test("runtime validation rejects impossible counters and unsafe numeric inputs", () => {
  assert.equal(
    combatRuntimeSchema.safeParse({ ...emptyRuntime(), temporaryHitPoints: -1 })
      .success,
    false,
  );
  assert.equal(
    combatRuntimeSchema.safeParse({
      ...emptyRuntime(),
      deathSaves: { successes: 4, failures: 0 },
    }).success,
    false,
  );
  assert.equal(
    combatRuntimeSchema.safeParse({
      ...emptyRuntime(),
      resources: [
        {
          id: crypto.randomUUID(),
          name: "Uses",
          maximum: 1,
          remaining: 2,
          reset: "manual",
        },
      ],
    }).success,
    false,
  );
});
test("saved snapshots outlive Bestiary edits/deletion; runtime, conditions, undo and portable exports round-trip", () => {
  const database = new DatabaseSync(":memory:");
  database.exec("PRAGMA foreign_keys=ON");
  runMigrations(database);
  database.exec(
    "INSERT INTO users VALUES('owner','Owner','owner','hash',1,1,1)",
  );
  const campaign = createCampaignRepository(database).create("owner", {
    name: "Runtime",
  });
  const bestiary = createBestiaryRepository(database),
    encounters = createEncounterRepository(database);
  const imageId = crypto.randomUUID();
  database
    .prepare(
      "INSERT INTO screenshots(id,filename,original_name,mime_type,size,uploaded_by,created_at) VALUES(?,?,'snapshot.png','image/png',1,'owner',1)",
    )
    .run(imageId, imageId + ".png");
  const originalAbility = `<p>Original ability</p><img src="/api/screenshots/${imageId}" />`;
  const monster = bestiary.create(campaign.id, "owner", {
    name: "Mage",
    type: "Humanoid",
    challengeRating: "2",
    armorClass: 12,
    hitPoints: 20,
    speed: "30 ft.",
    stats: "",
    abilities: originalAbility,
    spells: "",
    notes: "",
    spellSlots: [2],
    source: null,
    favorite: false,
  });
  const initial = encounters.getCombat(campaign.id, "owner");
  let saved = encounters.saveCombat(campaign.id, "owner", initial.revision, {
    ...initial,
    combatants: [
      {
        ...entry(),
        kind: "monster",
        monsterId: monster.id,
        runtime: undefined,
      },
    ],
  });
  assert.equal(saved.combatants[0].runtime!.resources[0].remaining, 2);
  database
    .prepare("UPDATE monsters SET abilities='<p>Changed</p>' WHERE id=?")
    .run(monster.id);
  assert.equal(
    encounters.getCombat(campaign.id, "owner").combatants[0].snapshot
      ?.abilities,
    originalAbility,
  );
  const edited = saved.combatants[0];
  edited.snapshot!.abilities += "<script>alert(1)</script>";
  edited.runtime!.resources[0].remaining = 1;
  edited.runtime!.temporaryHitPoints = 7;
  edited.runtime!.concentration = "Shield";
  edited.runtime!.deathSaves.failures = 2;
  edited.conditions = [
    {
      id: crypto.randomUUID(),
      name: "Held",
      remainingTurns: null,
      timing: "end-turn",
      requiresSave: true,
      saveDue: true,
    },
  ];
  saved = encounters.saveCombat(campaign.id, "owner", saved.revision, {
    ...saved,
    combatants: [edited],
  });
  const restored = encounters.getCombat(campaign.id, "owner");
  assert.equal(restored.combatants[0].snapshot!.abilities, originalAbility);
  assert.deepEqual(restored.combatants[0].runtime, edited.runtime);
  assert.deepEqual(restored.combatants[0].conditions, edited.conditions);
  const imported = importCampaign(
    database,
    "owner",
    exportCampaign(database, campaign.id, "owner"),
  );
  assert.deepEqual(
    encounters.getCombat(imported.id, "owner").combatants[0].runtime,
    edited.runtime,
  );
  const undo = encounters.undoCombat(campaign.id, "owner", saved.revision);
  assert.equal(undo.combatants[0].runtime!.temporaryHitPoints, 0);
  assert.equal(undo.combatants[0].runtime!.resources[0].remaining, 2);
  const beforeDelete = encounters.saveCombat(
    campaign.id,
    "owner",
    undo.revision,
    { ...undo, combatants: [{ ...undo.combatants[0], hitPoints: 3 }] },
  );
  database.prepare("DELETE FROM monsters WHERE id=?").run(monster.id);
  const orphan = encounters.getCombat(campaign.id, "owner").combatants[0];
  assert.equal(orphan.monsterId, null);
  assert.equal(orphan.snapshot?.abilities, originalAbility);
  const afterUndo = encounters.undoCombat(
    campaign.id,
    "owner",
    beforeDelete.revision,
  );
  assert.equal(afterUndo.combatants[0].monsterId, null);
  assert.equal(afterUndo.combatants[0].snapshot?.abilities, originalAbility);
  assert.equal(afterUndo.combatants[0].hitPoints, undo.combatants[0].hitPoints);
  assert.ok(
    database
      .prepare(
        "SELECT COUNT(*) AS count FROM screenshot_references WHERE screenshot_id=? AND resource_type='combat'",
      )
      .get(imageId)!.count,
  );
  database.close();
});

test("prepared players show roster race/class and preserve kind without a roster link", () => {
  const hero = entry();
  const roster: Player = {
    id: "roster-hero",
    campaignId: "campaign",
    name: "Hero",
    kind: "player",
    race: "Human",
    className: "Fighter",
    level: 3,
    hitPoints: 20,
    armorClass: 15,
    notes: "",
    revision: 1,
    createdAt: "",
    updatedAt: "",
  };
  const loaded = loadPreparation(
    combat([]),
    {
      id: "prepared",
      sessionId: "session",
      name: "Party",
      notes: "",
      sortOrder: 0,
      monsters: [],
      combatants: [hero],
      revision: 1,
      createdAt: "",
      updatedAt: "",
    },
    [],
  );
  assert.equal(loaded.combatants[0].playerId, null);
  assert.equal(
    combatantSummary(loaded.combatants[0], [roster], []),
    "Human · Fighter · Player · AC 15",
  );
  assert.equal(combatantSummary(hero, [], []), "Player · AC 15");
  assert.equal(
    combatantSummary(hero, [roster, { ...roster, id: "duplicate" }], []),
    "Player · AC 15",
  );
  assert.equal(
    combatantSummary({ ...hero, kind: "npc" }, [roster], []),
    "NPC · AC 15",
  );
  assert.equal(
    combatantSummary({ ...hero, kind: "monster" }, [roster], []),
    "Monster · AC 15",
  );
  assert.equal(
    combatantSummary(
      { ...hero, playerId: roster.id, name: "Renamed" },
      [roster],
      [],
    ),
    "Human · Fighter · Player · AC 15",
  );
});

test("preserving active allies replaces only monsters and retains live state", () => {
  const hero = {
    ...entry(),
    hitPoints: 3,
    initiative: 19,
    notes: "Live notes",
  };
  hero.conditions = [{ id: "condition", name: "Poisoned", remainingTurns: 2 }];
  hero.runtime = {
    ...emptyRuntime(),
    temporaryHitPoints: 4,
    concentration: "Bless",
  };
  const npc = { ...entry(), id: "npc", kind: "npc" as const, name: "Guide" };
  const oldMonster = {
    ...entry(),
    id: "old",
    kind: "monster" as const,
    name: "Old monster",
  };
  const current = { ...combat([hero, npc, oldMonster]), round: 5, turn: 2 };
  const prepared: PreparedEncounter = {
    id: "prepared",
    sessionId: "session",
    name: "Next",
    notes: "",
    sortOrder: 0,
    revision: 1,
    createdAt: "",
    updatedAt: "",
    monsters: [
      {
        id: "row",
        monsterId: "goblin",
        quantity: 2,
        displayNumber: 1,
        sortOrder: 0,
      },
    ],
    combatants: [
      { ...entry(), name: "New player" },
      { ...npc, id: "new-npc", name: "New NPC" },
      { ...oldMonster, id: "custom", name: "Custom monster" },
    ],
  };
  const sources = [
    { id: "goblin", name: "Goblin", hitPoints: 7, armorClass: 12 },
  ];
  const result = loadPreparation(current, prepared, sources, undefined, true);
  assert.equal(result.round, 1);
  assert.equal(result.turn, 0);
  assert.equal(result.combatants.length, 5);
  assert.deepEqual(
    result.combatants.find(({ id }) => id === hero.id),
    hero,
  );
  assert.deepEqual(
    result.combatants.find(({ id }) => id === npc.id),
    { ...npc, sortOrder: 1 },
  );
  assert.equal(
    result.combatants.filter(({ kind }) => kind === "monster").length,
    3,
  );
  assert.equal(
    result.combatants.some(({ name }) =>
      ["Old monster", "New player", "New NPC"].includes(name),
    ),
    false,
  );
  let allocations = 0;
  assert.throws(
    () =>
      loadPreparation(
        current,
        {
          ...prepared,
          combatants: [],
          monsters: [{ ...prepared.monsters[0], quantity: 10000 }],
        },
        sources,
        () => {
          allocations++;
          return crypto.randomUUID();
        },
        true,
      ),
    CombatCapacityError,
  );
  assert.equal(allocations, 0);
  assert.equal(current.round, 5);
  assert.equal(current.combatants.length, 3);
  const replaced = loadPreparation(
    current,
    prepared,
    sources,
    undefined,
    false,
  );
  assert.equal(replaced.combatants.length, 5);
  assert.equal(
    replaced.combatants.some(({ id }) => id === hero.id || id === npc.id),
    false,
  );
  assert.equal(
    replaced.combatants.some(({ name }) => name === "New player"),
    true,
  );
});
