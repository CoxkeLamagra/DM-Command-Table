import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { runMigrations } from "../db/migrations.ts";
import { createV6CampaignRepository } from "../server/v6/campaign-repository.ts";
import { createContentRepository } from "../server/v6/content-repository.ts";
import { createBestiaryRepository } from "../server/v6/bestiary-repository.ts";
import {
  createEncounterRepository,
  type V6Combatant,
} from "../server/v6/encounter-repository.ts";

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
    title: "Ambush",
    date: "2026-09-28",
    notes: "",
    status: "planned",
    sortOrder: 0,
  });
  const monster = bestiary.create(campaign.id, "owner", {
    name: "Goblin",
    type: "Humanoid",
    challengeRating: "1/4",
    armorClass: 15,
    hitPoints: 7,
    speed: "30 ft.",
    stats: "",
    abilities: "",
    spells: "",
    notes: "",
    spellSlots: [],
    source: "MM",
    favorite: false,
  });
  const prepared = encounters.createPrepared(campaign.id, "owner", session.id, {
    name: "Road ambush",
    notes: "",
    sortOrder: 0,
    monsters: [1, 2].map((displayNumber, sortOrder) => ({
      id: crypto.randomUUID(),
      monsterId: monster.id,
      displayNumber,
      quantity: 1,
      sortOrder,
    })),
  });
  assert.deepEqual(
    prepared.monsters.map(({ displayNumber }) => displayNumber),
    [1, 2],
  );
  database.close();
});

test("combat saves history, prevents duplicate linked players, and supports undo", () => {
  const { database, campaign, content, encounters } = fixture();
  const player = content.createPlayer(campaign.id, "owner", {
    name: "Karlach",
    race: "Tiefling",
    className: "Barbarian",
    level: 6,
    hitPoints: 65,
    armorClass: 15,
    notes: "",
  });
  const combatant: V6Combatant = {
    id: crypto.randomUUID(),
    playerId: player.id,
    monsterId: null,
    name: player.name,
    displayNumber: null,
    kind: "player",
    notes: "Hold the bridge",
    initiative: 18,
    hitPoints: 65,
    maximumHitPoints: 65,
    armorClass: 15,
    sortOrder: 0,
    revision: 1,
    conditions: [
      { id: crypto.randomUUID(), name: "Blessed", remainingTurns: 2 },
    ],
  };
  const initial = encounters.getCombat(campaign.id, "owner");
  const saved = encounters.saveCombat(
    campaign.id,
    "owner",
    initial.revision,
    {
      name: "Bridge",
      round: 1,
      turn: 0,
      combatants: [combatant],
    },
    "combatant_added",
  );
  assert.equal(saved.combatants[0]?.conditions[0]?.remainingTurns, 2);
  assert.equal(saved.combatants[0]?.notes, "Hold the bridge");
  assert.throws(() =>
    encounters.saveCombat(campaign.id, "owner", saved.revision, {
      ...saved,
      combatants: [combatant, { ...combatant, id: crypto.randomUUID() }],
    }),
  );
  const undone = encounters.undoCombat(campaign.id, "owner");
  assert.equal(undone.combatants.length, 0);
  database.close();
});

test("combat history retains only the configured number of undo states", () => {
  const previous = process.env.DM_COMMAND_TABLE_COMBAT_HISTORY_LIMIT;
  process.env.DM_COMMAND_TABLE_COMBAT_HISTORY_LIMIT = "2";
  const { database, campaign, encounters } = fixture();
  try {
    let combat = encounters.getCombat(campaign.id, "owner");
    for (let round = 2; round <= 5; round += 1) {
      combat = encounters.saveCombat(campaign.id, "owner", combat.revision, {
        name: "Bounded",
        round,
        turn: 0,
        combatants: [],
      });
    }
    const count = database
      .prepare("SELECT COUNT(*) AS count FROM combat_history")
      .get() as { count: number };
    assert.equal(count.count, 2);
  } finally {
    if (previous === undefined)
      delete process.env.DM_COMMAND_TABLE_COMBAT_HISTORY_LIMIT;
    else process.env.DM_COMMAND_TABLE_COMBAT_HISTORY_LIMIT = previous;
    database.close();
  }
});

test("combat rejects records linked to a different campaign", () => {
  const { database, campaign, content, encounters } = fixture();
  const second = createV6CampaignRepository(database).create("owner", {
    name: "Other",
  });
  const outsider = content.createPlayer(second.id, "owner", {
    name: "Outsider",
    race: "Human",
    className: "Fighter",
    level: 1,
    hitPoints: 12,
    armorClass: 16,
    notes: "",
  });
  const combat = encounters.getCombat(campaign.id, "owner");
  assert.throws(() =>
    encounters.saveCombat(campaign.id, "owner", combat.revision, {
      name: "Invalid link",
      round: 1,
      turn: 0,
      combatants: [
        {
          id: crypto.randomUUID(),
          playerId: outsider.id,
          monsterId: null,
          name: outsider.name,
          displayNumber: null,
          kind: "player",
          notes: "",
          initiative: 10,
          hitPoints: 12,
          maximumHitPoints: 12,
          armorClass: 16,
          sortOrder: 0,
          revision: 1,
          conditions: [],
        },
      ],
    }),
  );
  database.close();
});

test("prepared custom combatants persist independently with editable combat details", () => {
  const { database, campaign, content, encounters } = fixture();
  const session = content.createSession(campaign.id, "owner", {
    title: "Custom encounter",
    date: "",
    notes: "",
    status: "planned",
    sortOrder: 0,
  });
  const custom: V6Combatant = {
    id: crypto.randomUUID(),
    playerId: null,
    monsterId: null,
    name: "Town guard",
    kind: "npc",
    displayNumber: null,
    initiative: 12,
    hitPoints: 18,
    maximumHitPoints: 20,
    armorClass: 16,
    notes: "<p>STR 14; Spear</p><script>alert(1)</script>",
    sortOrder: 0,
    conditions: [],
    revision: 1,
  };
  const encounter = encounters.createPrepared(
    campaign.id,
    "owner",
    session.id,
    {
      name: "Gate",
      notes: "",
      sortOrder: 0,
      monsters: [],
      combatants: [custom],
    },
  );
  assert.equal(encounter.combatants?.[0].name, "Town guard");
  assert.equal(encounter.combatants?.[0].notes, "<p>STR 14; Spear</p>");
  const changed = encounters.updatePrepared(
    campaign.id,
    "owner",
    encounter.id,
    encounter.revision,
    {
      ...encounter,
      combatants: [
        { ...encounter.combatants![0], name: "Captain", hitPoints: 25 },
      ],
    },
  );
  const reloaded = encounters.listPrepared(campaign.id, "owner", session.id)[0];
  assert.deepEqual(reloaded.combatants, changed.combatants);
  assert.equal(reloaded.combatants?.[0].name, "Captain");
  assert.equal(reloaded.combatants?.[0].hitPoints, 25);
  assert.equal(reloaded.combatants?.[0].armorClass, 16);
  database.close();
});

test("campaign NPCs persist their type and import into combat with duplicate protection", () => {
  const { database, campaign, content, encounters } = fixture();
  const npc = content.createPlayer(campaign.id, "owner", {
    kind: "npc",
    name: "Mira",
    race: "Human",
    className: "Guard",
    level: 2,
    hitPoints: 18,
    armorClass: 14,
    notes: "Campaign ally",
  });
  assert.equal(content.listPlayers(campaign.id, "owner")[0].kind, "npc");
  const initial = encounters.getCombat(campaign.id, "owner");
  const entry: V6Combatant = {
    id: crypto.randomUUID(),
    playerId: npc.id,
    monsterId: null,
    name: npc.name,
    kind: "npc",
    notes: npc.notes,
    displayNumber: null,
    initiative: 10,
    hitPoints: 18,
    maximumHitPoints: 18,
    armorClass: 14,
    sortOrder: 0,
    conditions: [],
    revision: 1,
  };
  const saved = encounters.saveCombat(campaign.id, "owner", initial.revision, {
    name: "NPC encounter",
    round: 1,
    turn: 0,
    combatants: [entry],
  });
  assert.equal(saved.combatants[0].kind, "npc");
  assert.equal(saved.combatants[0].playerId, npc.id);
  assert.throws(() =>
    encounters.saveCombat(campaign.id, "owner", saved.revision, {
      name: saved.name,
      round: 1,
      turn: 0,
      combatants: [entry, { ...entry, id: crypto.randomUUID() }],
    }),
  );
  const updated = content.updatePlayer(
    campaign.id,
    "owner",
    npc.id,
    npc.revision,
    { ...npc, kind: "player" },
  );
  assert.equal(updated.kind, "player");
  database.close();
});
