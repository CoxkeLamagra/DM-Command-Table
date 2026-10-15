import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { runMigrations } from "../db/migrations.ts";
import { createCampaignRepository } from "../server/campaigns/campaign-repository.ts";
import { createContentRepository } from "../server/content/content-repository.ts";
import { createBestiaryRepository } from "../server/bestiary/bestiary-repository.ts";
import {
  createEncounterRepository,
  type Combatant,
} from "../server/encounters/encounter-repository.ts";

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
  const combatant: Combatant = {
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
  const second = createCampaignRepository(database).create("owner", {
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
  const custom: Combatant = {
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
  const entry: Combatant = {
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

test("prepared ordering is atomic, revision checked and scoped to an editable session", () => {
  const { database, campaign, content, encounters } = fixture();
  try {
    const session = content.createSession(campaign.id, "owner", {
      title: "Ordering",
      date: "",
      notes: "",
      status: "planned",
      sortOrder: 0,
    });
    const other = content.createSession(campaign.id, "owner", {
      title: "Other",
      date: "",
      notes: "",
      status: "planned",
      sortOrder: 1,
    });
    const input = {
      name: "First",
      notes: "<p>Keep me</p>",
      sortOrder: 0,
      monsters: [],
      combatants: [],
    };
    const a = encounters.createPrepared(
      campaign.id,
      "owner",
      session.id,
      input,
    );
    const b = encounters.createPrepared(campaign.id, "owner", session.id, {
      ...input,
      name: "Second",
      sortOrder: 1,
    });
    const foreign = encounters.createPrepared(
      campaign.id,
      "owner",
      other.id,
      input,
    );
    assert.throws(
      () =>
        encounters.reorderPrepared(campaign.id, "owner", session.id, [
          b,
          foreign,
        ]),
      { status: 409 },
    );
    assert.throws(
      () =>
        encounters.reorderPrepared(campaign.id, "owner", session.id, [a, a]),
      { status: 409 },
    );
    assert.throws(
      () =>
        encounters.reorderPrepared(campaign.id, "owner", session.id, [
          b,
          { ...a, revision: a.revision + 1 },
        ]),
      { name: "RevisionConflictError" },
    );
    assert.deepEqual(
      encounters
        .listPrepared(campaign.id, "owner", session.id)
        .map(({ id, revision }) => ({ id, revision })),
      [a, b].map(({ id, revision }) => ({ id, revision })),
    );
    const reordered = encounters.reorderPrepared(
      campaign.id,
      "owner",
      session.id,
      [b, a],
    );
    assert.deepEqual(
      reordered.map(({ id, sortOrder }) => ({ id, sortOrder })),
      [
        { id: b.id, sortOrder: 0 },
        { id: a.id, sortOrder: 1 },
      ],
    );
    assert.equal(reordered[1].notes, "<p>Keep me</p>");
    database
      .prepare(
        "INSERT INTO users VALUES('viewer','Viewer','viewer','unused',0,1,1)",
      )
      .run();
    database
      .prepare(
        "INSERT INTO campaign_members VALUES(?, 'viewer', 'viewer', 1, 1)",
      )
      .run(campaign.id);
    assert.throws(() =>
      encounters.reorderPrepared(campaign.id, "viewer", session.id, reordered),
    );
  } finally {
    database.close();
  }
});

test("prepared writes validate repeated Bestiary references once and retain persistence sanitization", () => {
  const { database, campaign, content, bestiary } = fixture();
  try {
    const session = content.createSession(campaign.id, "owner", {
      title: "Indexed",
      date: "",
      notes: "",
      status: "planned",
      sortOrder: 0,
    });
    const monster = bestiary.create(campaign.id, "owner", {
      name: "Goblin",
      type: "Humanoid",
      challengeRating: "1/4",
      hitPoints: 7,
      armorClass: 15,
      speed: "30 ft.",
      stats: "",
      abilities: "",
      spells: "",
      notes: "",
      spellSlots: [],
      source: "MM",
      favorite: false,
    });
    let lookups = 0;
    const wrapper = {
      exec: database.exec.bind(database),
      prepare: (sql: string) => {
        const prepared = database.prepare(sql);
        if (
          sql ===
          "SELECT id FROM monsters WHERE id = ? AND campaign_id = ? LIMIT 1"
        ) {
          prepared.get = new Proxy(prepared.get, {
            apply(target, _thisArg, args) {
              lookups++;
              return Reflect.apply(target, prepared, args);
            },
          });
        }
        return prepared;
      },
    } as unknown as DatabaseSync;
    const repository = createEncounterRepository(wrapper);
    const encounter = repository.createPrepared(
      campaign.id,
      "owner",
      session.id,
      {
        name: "Many copies",
        notes: "<p>Safe</p><script>bad()</script>",
        sortOrder: 0,
        monsters: Array.from({ length: 100 }, (_, index) => ({
          id: crypto.randomUUID(),
          monsterId: monster.id,
          displayNumber: index + 1,
          quantity: 1,
          sortOrder: index,
        })),
        combatants: [
          {
            id: crypto.randomUUID(),
            name: "Guard",
            kind: "npc",
            notes: "<p>Guard</p><script>bad()</script>",
            displayNumber: null,
            initiative: 10,
            hitPoints: 10,
            maximumHitPoints: 10,
            armorClass: 10,
            sortOrder: 0,
          },
        ],
      },
    );
    assert.equal(lookups, 1);
    assert.equal(encounter.monsters.length, 100);
    assert.equal(encounter.notes, "<p>Safe</p>");
    assert.equal(encounter.combatants![0].notes, "<p>Guard</p>");
  } finally {
    database.close();
  }
});
