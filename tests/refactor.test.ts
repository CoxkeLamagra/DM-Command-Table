import { emptyRuntime } from "../domain/combat-runtime.ts";
import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { runMigrations } from "../db/migrations.ts";
import { createCampaignRepository } from "../server/campaigns/campaign-repository.ts";
import { createContentRepository } from "../server/content/content-repository.ts";
import { createEncounterRepository } from "../server/encounters/encounter-repository.ts";
import { handleApi } from "../server/api/api-router.ts";
import { deleteManagedUser } from "../server/identity/accounts.ts";
import { listScreenshots } from "../server/media/screenshots.ts";
import { applyCombatAction, orderedCombatants } from "../domain/combat.ts";
import type { Combatant, CombatEncounter } from "../domain/encounters.ts";
function fixture() {
  const database = new DatabaseSync(":memory:");
  database.exec("PRAGMA foreign_keys=ON");
  runMigrations(database);
  database.exec(
    "INSERT INTO users VALUES('owner','Owner','owner','hash',1,1,1); INSERT INTO users VALUES('editor','Editor','editor','hash',0,1,1)",
  );
  const campaign = createCampaignRepository(database).create("owner", {
    name: "Fixture",
  });
  database
    .prepare("INSERT INTO campaign_members VALUES(?,?,'editor',1,1)")
    .run(campaign.id, "editor");
  return {
    database,
    campaign,
    content: createContentRepository(database),
    encounters: createEncounterRepository(database),
  };
}
function entry(id: string, initiative: number, hp = 10): Combatant {
  return {
    id,
    initiative,
    hitPoints: hp,
    maximumHitPoints: 10,
    armorClass: 10,
    kind: "npc",
    name: id,
    playerId: null,
    monsterId: null,
    notes: "",
    displayNumber: null,
    sortOrder: initiative,
    conditions: [],
    revision: 1,
  };
}
test("Combat router sanitizes notes and bulk delete rolls back the entire selection", async () => {
  const { database, campaign, content, encounters } = fixture();
  const combat = encounters.getCombat(campaign.id, "owner");
  const fighter = {
    ...entry(crypto.randomUUID(), 10),
    notes:
      '<p><b>Safe</b></p><img src=x onerror="alert(1)"><script>bad()</script>',
  };
  const response = await handleApi(
    new Request(`http://local/api/campaigns/${campaign.id}/combat`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...combat, combatants: [fighter] }),
    }),
    database,
    { userId: "owner", isAdmin: true },
  );
  assert.equal(response.status, 200);
  const { combat: saved } = await response.json();
  assert.equal(saved.combatants[0].notes, "<p><b>Safe</b></p>");
  const player = content.createPlayer(campaign.id, "owner", {
    kind: "player",
    name: "Hero",
    race: "",
    className: "",
    level: null,
    hitPoints: null,
    armorClass: null,
    notes: "",
  });
  const result = await handleApi(
    new Request(
      `http://local/api/campaigns/${campaign.id}/players/bulk-delete`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ids: [player.id, crypto.randomUUID()] }),
      },
    ),
    database,
    { userId: "owner", isAdmin: true },
  );
  assert.equal(result.status, 404);
  assert.equal(content.listPlayers(campaign.id, "owner").length, 1);
  database.close();
});
test("Removing an uploader preserves referenced images and access in surviving campaigns", () => {
  const { database, campaign, content } = fixture();
  const id = crypto.randomUUID();
  database
    .prepare(
      "INSERT INTO screenshots(id,filename,original_name,mime_type,size,uploaded_by,created_at) VALUES(?,?,?,'image/webp',10,'editor',1)",
    )
    .run(id, id + ".webp", "map");
  content.createSession(campaign.id, "editor", {
    title: "Map",
    date: "",
    status: "planned",
    sortOrder: 0,
    notes: `<img src="/api/screenshots/${id}">`,
  });
  deleteManagedUser(database, "editor", "owner");
  assert.equal(
    database.prepare("SELECT uploaded_by FROM screenshots WHERE id=?").get(id)
      ?.uploaded_by,
    null,
  );
  assert.equal(listScreenshots(database, "owner", false)[0]?.id, id);
  assert.equal(listScreenshots(database, "unknown", false).length, 0);
  database.close();
});
test("Turn rules skip downed entries, expire only incoming conditions, and wrap a single survivor", () => {
  const a = entry("a", 20),
    b = entry("b", 10, 0),
    c = {
      ...entry("c", 5),
      conditions: [{ id: "x", name: "Blinded", remainingTurns: 2 }],
    };
  const combat: CombatEncounter = {
    id: "e",
    campaignId: "c",
    name: "Encounter",
    revision: 1,
    round: 1,
    turn: 0,
    combatants: [a, b, c],
    createdAt: "",
    updatedAt: "",
  };
  let next = applyCombatAction(combat, "next-turn");
  assert.equal(next.combatants[next.turn].id, "c");
  assert.equal(next.round, 1);
  assert.equal(next.combatants[2].conditions[0].remainingTurns, 1);
  next = applyCombatAction(next, "next-turn");
  assert.equal(next.combatants[next.turn].id, "a");
  assert.equal(next.round, 2);
  const only = applyCombatAction(
    {
      ...combat,
      combatants: [
        { ...a, conditions: [{ id: "y", name: "Prone", remainingTurns: 1 }] },
      ],
    },
    "next-turn",
  );
  assert.equal(only.round, 2);
  assert.equal(only.combatants[0].conditions.length, 0);
  const allDown = applyCombatAction(
    { ...combat, combatants: [b] },
    "next-turn",
  );
  assert.equal(allDown.round, 1);
});
test("Undo rejects stale revisions and unchanged combatants retain their database rows", () => {
  const { database, campaign, encounters } = fixture();
  const initial = encounters.getCombat(campaign.id, "owner");
  const first = encounters.saveCombat(campaign.id, "owner", initial.revision, {
    ...initial,
    combatants: [entry(crypto.randomUUID(), 12)],
  });
  const before = database.prepare("SELECT rowid FROM combatants").get()?.rowid;
  const second = encounters.saveCombat(campaign.id, "owner", first.revision, {
    ...first,
    name: "Renamed",
  });
  assert.equal(
    database.prepare("SELECT rowid FROM combatants").get()?.rowid,
    before,
  );
  assert.throws(
    () => encounters.undoCombat(campaign.id, "owner", first.revision),
    /changed|revision/i,
  );
  assert.equal(
    encounters.undoCombat(campaign.id, "owner", second.revision).name,
    first.name,
  );
  database.close();
});

test("campaign packages remap embedded images and reject incomplete packages", async () => {
  const { mkdtempSync, rmSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const sharp = (await import("sharp")).default;
  const { saveScreenshot, extractScreenshotIds, readScreenshot } =
    await import("../server/media/screenshots.ts");
  const { exportCampaignPackage, importCampaignPackage } =
    await import("../server/campaigns/campaign-package.ts");
  const directory = mkdtempSync(join(tmpdir(), "dmct-package-"));
  const oldPath = process.env.DM_COMMAND_TABLE_UPLOAD_PATH;
  process.env.DM_COMMAND_TABLE_UPLOAD_PATH = directory;
  const { database, campaign, content } = fixture();
  try {
    const bytes = await sharp({
      create: { width: 2, height: 2, channels: 3, background: "red" },
    })
      .png()
      .toBuffer();
    const image = await saveScreenshot(
      database,
      new File([bytes], "map.png", { type: "image/png" }),
      "owner",
    );
    content.createSession(campaign.id, "owner", {
      title: "Map",
      date: "",
      status: "planned",
      sortOrder: 0,
      notes: `<p>Map</p><img src="/api/screenshots/${image.id}">`,
    });
    const pack = await exportCampaignPackage(database, campaign.id, "owner");
    assert.equal(pack.assets.length, 1);
    const imported = await importCampaignPackage(database, "editor", pack);
    const sessions = content.listSessions(imported.id, "editor");
    const [newId] = extractScreenshotIds(sessions[0].notes);
    assert.notEqual(newId, image.id);
    assert.ok(await readScreenshot(database, newId, "editor", false));
    assert.equal(
      database
        .prepare("SELECT COUNT(*) AS n FROM screenshots WHERE staging=1")
        .get()?.n,
      0,
    );
    await assert.rejects(
      () => importCampaignPackage(database, "editor", { ...pack, assets: [] }),
      /missing|duplicate/,
    );
    assert.equal(createCampaignRepository(database).list("editor").length, 2);
  } finally {
    database.close();
    if (oldPath === undefined) delete process.env.DM_COMMAND_TABLE_UPLOAD_PATH;
    else process.env.DM_COMMAND_TABLE_UPLOAD_PATH = oldPath;
    rmSync(directory, { recursive: true, force: true });
  }
});

test("server combat commands retain submitted drafts and reject stale revisions", async () => {
  const { database, campaign, encounters } = fixture();
  try {
    const initial = encounters.getCombat(campaign.id, "owner");
    const draft = {
      ...initial,
      name: "Unsaved encounter title",
      combatants: [
        entry(crypto.randomUUID(), 20),
        entry(crypto.randomUUID(), 10),
      ],
    };
    const command = (combat: typeof draft) =>
      handleApi(
        new Request(
          `http://local/api/campaigns/${campaign.id}/combat/command`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ command: "next-turn", combat }),
          },
        ),
        database,
        { userId: "owner", isAdmin: true },
      );
    const result = await command(draft);
    assert.equal(result.status, 200);
    const { combat } = await result.json();
    assert.equal(combat.name, draft.name);
    assert.equal(combat.turn, 1);
    assert.equal(combat.combatants.length, 2);
    assert.equal((await command(draft)).status, 409);
    assert.equal(
      encounters.getCombat(campaign.id, "owner").revision,
      combat.revision,
    );
  } finally {
    database.close();
  }
});

test("prepared loading rejects Viewers before reading their request body", async () => {
  const { database, campaign } = fixture();
  database
    .prepare(
      "UPDATE campaign_members SET role = 'viewer' WHERE campaign_id = ? AND user_id = 'editor'",
    )
    .run(campaign.id);
  const request = new Request(
    `http://local/api/campaigns/${campaign.id}/combat/load-prepared`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "invalid JSON",
    },
  );
  try {
    const response = await handleApi(request, database, {
      userId: "editor",
      isAdmin: false,
    });
    assert.equal(response.status, 403);
    assert.equal(request.bodyUsed, false);
    assert.equal((await response.json()).code, "forbidden");
  } finally {
    database.close();
  }
});

test("prepared loading bounds expanded quantities before any combatant allocation", async () => {
  const { loadPreparation, CombatCapacityError } =
    await import("../domain/combat.ts");
  const { preparedEncounterSchema } = await import("../server/http/schemas.ts");
  const { apiError } = await import("../server/http/http.ts");
  const { database, campaign, content, encounters } = fixture();
  try {
    const combat = encounters.getCombat(campaign.id, "owner");
    const monsterId = crypto.randomUUID();
    const prepared = {
      id: crypto.randomUUID(),
      sessionId: crypto.randomUUID(),
      revision: 1,
      createdAt: "",
      updatedAt: "",
      name: "Bounded",
      notes: "",
      sortOrder: 0,
      monsters: Array.from({ length: 11 }, (_, sortOrder) => ({
        id: crypto.randomUUID(),
        monsterId,
        quantity: 1000,
        displayNumber: null,
        sortOrder,
      })),
      combatants: [],
    };
    let allocations = 0;
    const id = () => {
      allocations++;
      return crypto.randomUUID();
    };
    const sources = [
      { id: monsterId, name: "Goblin", hitPoints: 7, armorClass: 15 },
    ];
    assert.throws(
      () => loadPreparation(combat, prepared, sources, id),
      CombatCapacityError,
    );
    assert.equal(allocations, 0);
    assert.equal(preparedEncounterSchema.safeParse(prepared).success, false);
    const bounded = { ...prepared, monsters: prepared.monsters.slice(0, 10) };
    const result = loadPreparation(combat, bounded, sources, id);
    assert.equal(result.combatants.length, 10000);
    assert.equal(result.name, "Bounded");
    assert.equal(result.combatants[0].kind, "monster");
    allocations = 0;
    const survivor = entry(crypto.randomUUID(), 12);
    assert.equal(
      loadPreparation(
        { ...combat, combatants: [survivor] },
        bounded,
        sources,
        id,
      ).combatants.length,
      10000,
    );
    allocations = 0;
    assert.throws(
      () =>
        loadPreparation(
          combat,
          { ...bounded, combatants: [survivor] },
          sources,
          id,
        ),
      CombatCapacityError,
    );
    assert.equal(allocations, 0);
    assert.equal(
      preparedEncounterSchema.safeParse({ ...bounded, combatants: [survivor] })
        .success,
      false,
    );
    assert.equal(apiError(new CombatCapacityError()).status, 400);
    const session = content.createSession(campaign.id, "owner", {
      title: "Limits",
      date: "",
      notes: "",
      status: "planned",
      sortOrder: 0,
    });
    for (const [path, payload] of [
      [
        `combat/load-prepared`,
        {
          revision: combat.revision,
          prepared: { ...prepared, sessionId: session.id },
        },
      ],
      [
        `sessions/${session.id}/save`,
        {
          session,
          encounters: [
            { ...bounded, sessionId: session.id, combatants: [survivor] },
          ],
        },
      ],
    ] as const) {
      const response = await handleApi(
        new Request(`http://local/api/campaigns/${campaign.id}/${path}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        }),
        database,
        { userId: "owner", isAdmin: true },
      );
      assert.equal(response.status, 400);
    }
    assert.equal(
      encounters.getCombat(campaign.id, "owner").revision,
      combat.revision,
    );
    assert.throws(
      () =>
        encounters.createPrepared(campaign.id, "owner", session.id, {
          ...bounded,
          combatants: [survivor],
        }),
      CombatCapacityError,
    );
    assert.equal(
      encounters.listPrepared(campaign.id, "owner", session.id).length,
      0,
    );
  } finally {
    database.close();
  }
});

test("editors can load prepared Players and NPCs while replacing all existing combatants", async () => {
  const { database, campaign, content, encounters } = fixture();
  try {
    const session = content.createSession(campaign.id, "owner", {
      title: "Allies",
      date: "",
      notes: "",
      status: "planned",
      sortOrder: 0,
    });
    const retained = {
      ...entry(crypto.randomUUID(), 15),
      kind: "player" as const,
      name: "Hero",
    };
    const initial = encounters.getCombat(campaign.id, "owner");
    const combat = encounters.saveCombat(
      campaign.id,
      "owner",
      initial.revision,
      {
        ...initial,
        combatants: [
          retained,
          { ...entry(crypto.randomUUID(), 14), name: "Old NPC" },
          {
            ...entry(crypto.randomUUID(), 13),
            kind: "monster",
            name: "Old monster",
          },
        ],
      },
    );
    const prepared = encounters.createPrepared(
      campaign.id,
      "owner",
      session.id,
      {
        name: "Allies",
        notes: "",
        sortOrder: 0,
        monsters: [],
        combatants: [
          { ...entry(crypto.randomUUID(), 10), name: "Guide" },
          { ...entry(crypto.randomUUID(), 10), name: "Guide" },
          {
            ...entry(crypto.randomUUID(), 10),
            kind: "monster",
            name: "Goblin",
          },
          {
            ...entry(crypto.randomUUID(), 10),
            kind: "monster",
            name: "Goblin",
          },
          {
            ...entry(crypto.randomUUID(), 12, 5),
            kind: "player",
            name: "Hero",
            sortOrder: 98,
          },
          {
            ...entry(crypto.randomUUID(), 12, 8),
            kind: "player",
            name: " hero ",
            sortOrder: 99,
          },
        ],
      },
    );
    const response = await handleApi(
      new Request(
        `http://local/api/campaigns/${campaign.id}/combat/load-prepared`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ revision: combat.revision, prepared }),
        },
      ),
      database,
      { userId: "editor", isAdmin: false },
    );
    assert.equal(response.status, 200);
    const saved = encounters.getCombat(campaign.id, "owner");
    assert.equal(saved.combatants.length, 5);
    assert.equal(
      saved.combatants.filter(({ kind }) => kind === "player").length,
      1,
    );
    assert.equal(
      saved.combatants.filter(({ kind }) => kind === "npc").length,
      2,
    );
    assert.equal(
      saved.combatants.some(({ id }) => id === retained.id),
      false,
    );
    assert.equal(
      saved.combatants.filter(({ kind }) => kind === "monster").length,
      2,
    );
    assert.equal(
      saved.combatants.find(({ kind }) => kind === "player")?.hitPoints,
      8,
    );
    assert.equal(
      saved.combatants.some(({ name }) => name.startsWith("Old ")),
      false,
    );
    const player = saved.combatants.find(({ kind }) => kind === "player")!;
    assert.throws(
      () =>
        encounters.saveCombat(campaign.id, "owner", saved.revision, {
          ...saved,
          combatants: [
            ...saved.combatants,
            { ...player, id: crypto.randomUUID(), name: "HERO" },
          ],
        }),
      /unique names/,
    );
    assert.equal(
      encounters.getCombat(campaign.id, "owner").revision,
      saved.revision,
    );
    const undone = encounters.undoCombat(campaign.id, "owner", saved.revision);
    assert.equal(undone.combatants.length, 3);
    assert.equal(
      undone.combatants.some(({ id }) => id === retained.id),
      true,
    );
    const empty = await handleApi(
      new Request(
        `http://local/api/campaigns/${campaign.id}/combat/load-prepared`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            revision: undone.revision,
            prepared: { ...prepared, combatants: [], monsters: [] },
          }),
        },
      ),
      database,
      { userId: "editor", isAdmin: false },
    );
    assert.equal(empty.status, 200);
    assert.equal(
      encounters.getCombat(campaign.id, "owner").combatants.length,
      0,
    );
    assert.equal(saved.round, 1);
  } finally {
    database.close();
  }
});

test("combat commands enforce the submitted zero-HP policy and reject invalid policies", async () => {
  const { database, campaign, encounters } = fixture();
  try {
    const initial = encounters.getCombat(campaign.id, "owner");
    const monster = {
      ...entry(crypto.randomUUID(), 20),
      kind: "monster" as const,
    };
    const hero = {
      ...entry(crypto.randomUUID(), 10, 0),
      kind: "player" as const,
    };
    const saved = encounters.saveCombat(
      campaign.id,
      "owner",
      initial.revision,
      { ...initial, combatants: [monster, hero] },
    );
    const request = (zeroHpPolicy: string) =>
      new Request(`http://local/api/campaigns/${campaign.id}/combat/command`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          combat: saved,
          command: "next-turn",
          zeroHpPolicy,
        }),
      });
    const invalid = await handleApi(request("invalid"), database, {
      userId: "owner",
      isAdmin: true,
    });
    assert.equal(invalid.status, 400);
    const result = await handleApi(request("include-players"), database, {
      userId: "owner",
      isAdmin: true,
    });
    assert.equal(result.status, 200);
    const { combat: next } = await result.json();
    assert.equal(orderedCombatants(next.combatants)[next.turn].id, hero.id);
    const stale = await handleApi(request("include-all"), database, {
      userId: "owner",
      isAdmin: true,
    });
    assert.equal(stale.status, 409);
    assert.equal(
      encounters.getCombat(campaign.id, "owner").revision,
      next.revision,
    );
  } finally {
    database.close();
  }
});

test("combat API validates live resources before writes and applies end-turn save prompts", async () => {
  const { database, campaign, encounters } = fixture();
  try {
    const initial = encounters.getCombat(campaign.id, "owner");
    const first = {
      ...entry(crypto.randomUUID(), 20),
      runtime: emptyRuntime(),
      conditions: [
        {
          id: crypto.randomUUID(),
          name: "Held",
          remainingTurns: 1,
          timing: "end-turn" as const,
          requiresSave: true,
        },
      ],
    };
    const saved = encounters.saveCombat(
      campaign.id,
      "owner",
      initial.revision,
      { ...initial, combatants: [first, entry(crypto.randomUUID(), 10)] },
    );
    const request = (value: unknown) =>
      new Request(`http://local/api/campaigns/${campaign.id}/combat/command`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ command: "next-turn", combat: value }),
      });
    const invalid = await handleApi(
      request({
        ...saved,
        combatants: [
          {
            ...saved.combatants[0],
            runtime: {
              ...emptyRuntime(),
              deathSaves: { successes: 0, failures: 4 },
            },
          },
        ],
      }),
      database,
      { userId: "owner", isAdmin: true },
    );
    assert.equal(invalid.status, 400);
    assert.equal(
      encounters.getCombat(campaign.id, "owner").revision,
      saved.revision,
    );
    const result = await handleApi(request(saved), database, {
      userId: "owner",
      isAdmin: true,
    });
    assert.equal(result.status, 200);
    const { combat: next } = await result.json();
    assert.equal(
      next.combatants.find((value: Combatant) => value.id === first.id)
        .conditions[0].saveDue,
      true,
    );
  } finally {
    database.close();
  }
});

test("failed updates do not disclose revision metadata from another campaign", async () => {
  const { database, campaign, content, encounters } = fixture();
  const { ResourceNotFoundError } = await import("../server/http/conflicts.ts");
  const other = createCampaignRepository(database).create("owner", {
    name: "Private campaign",
  });
  try {
    const player = content.createPlayer(other.id, "owner", {
      kind: "player",
      name: "Private hero",
      race: "",
      className: "",
      level: null,
      hitPoints: null,
      armorClass: null,
      notes: "",
    });
    const session = content.createSession(other.id, "owner", {
      title: "Private session",
      date: "",
      status: "planned",
      notes: "",
      sortOrder: 0,
    });
    const story = content.createStoryBeat(other.id, "owner", {
      title: "Private story",
      chapter: "",
      details: "",
      status: "planned",
      sortOrder: 0,
      sessionIds: [],
    });
    const prepared = encounters.createPrepared(other.id, "owner", session.id, {
      name: "Private encounter",
      notes: "",
      sortOrder: 0,
      monsters: [],
      combatants: [],
    });
    assert.throws(
      () =>
        content.updatePlayer(
          campaign.id,
          "editor",
          player.id,
          player.revision,
          player,
        ),
      ResourceNotFoundError,
    );
    assert.throws(
      () =>
        content.updateSession(
          campaign.id,
          "editor",
          session.id,
          session.revision,
          session,
        ),
      ResourceNotFoundError,
    );
    assert.throws(
      () =>
        content.updateStoryBeat(
          campaign.id,
          "editor",
          story.id,
          story.revision,
          story,
        ),
      ResourceNotFoundError,
    );
    assert.throws(
      () =>
        encounters.updatePrepared(
          campaign.id,
          "editor",
          prepared.id,
          prepared.revision,
          prepared,
        ),
      ResourceNotFoundError,
    );
    assert.equal(
      content.listPlayers(other.id, "owner")[0].revision,
      player.revision,
    );
    assert.equal(
      content.listSessions(other.id, "owner")[0].revision,
      session.revision,
    );
  } finally {
    database.close();
  }
});

test("malformed nested API paths cannot fall back to parent mutations or another session", async () => {
  const { database, campaign, content, encounters } = fixture();
  try {
    const sessionInput = {
      title: "First",
      date: "",
      notes: "",
      status: "planned" as const,
      sortOrder: 0,
    };
    const a = content.createSession(campaign.id, "owner", sessionInput);
    const b = content.createSession(campaign.id, "owner", {
      ...sessionInput,
      title: "Second",
    });
    const prepared = encounters.createPrepared(campaign.id, "owner", a.id, {
      name: "Keep",
      notes: "",
      sortOrder: 0,
      monsters: [],
      combatants: [],
    });
    const base = `http://local/api/campaigns/${campaign.id}/sessions`;
    const request = async (path: string, method: string, body?: unknown) =>
      handleApi(
        new Request(path, {
          method,
          headers: { "content-type": "application/json" },
          body: body === undefined ? undefined : JSON.stringify(body),
        }),
        database,
        { userId: "owner", isAdmin: true },
      );
    assert.equal(
      (await request(`${base}/${a.id}/unexpected`, "DELETE")).status,
      404,
    );
    assert.equal(
      (
        await request(`${base}/${a.id}/encounters/reorder/extra`, "POST", {
          ...prepared,
        })
      ).status,
      404,
    );
    assert.equal(
      (await request(`${base}/${b.id}/encounters/${prepared.id}`, "DELETE"))
        .status,
      404,
    );
    assert.equal(
      (
        await request(`${base}/${b.id}/encounters/${prepared.id}`, "PATCH", {
          ...prepared,
          name: "Wrong parent",
        })
      ).status,
      404,
    );
    assert.equal(content.listSessions(campaign.id, "owner").length, 2);
    assert.equal(
      encounters.listPrepared(campaign.id, "owner", a.id)[0].name,
      "Keep",
    );
    assert.equal(
      (
        await request(`${base}/${a.id}/encounters/${prepared.id}`, "PATCH", {
          ...prepared,
          name: "Correct parent",
        })
      ).status,
      200,
    );
  } finally {
    database.close();
  }
});
