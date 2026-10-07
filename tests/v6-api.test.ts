import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { runMigrations } from "../db/migrations.ts";
import { handleV6Api } from "../server/v6/api-router.ts";

const ownerId = "11111111-1111-4111-8111-111111111111";
const viewerId = "22222222-2222-4222-8222-222222222222";

function fixture() {
  const database = new DatabaseSync(":memory:");
  database.exec("PRAGMA foreign_keys = ON");
  runMigrations(database);
  const now = Date.now();
  const insert = database.prepare(
    `INSERT INTO users
      (id, display_name, username, password_hash, is_admin, created_at, updated_at)
     VALUES (?, ?, ?, 'hash', 0, ?, ?)`,
  );
  insert.run(ownerId, "Owner", "owner", now, now);
  insert.run(viewerId, "Viewer", "viewer", now, now);
  return database;
}

function request(path: string, method = "GET", body?: unknown): Request {
  return new Request(`http://localhost/api/v6/${path}`, {
    method,
    headers:
      body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

test("v6 API creates campaigns and returns private responses", async () => {
  const database = fixture();
  const response = await handleV6Api(
    request("campaigns", "POST", { name: "Icewind Dale", notes: "Cold" }),
    database,
    { userId: ownerId, isAdmin: false },
  );
  assert.equal(response.status, 201);
  assert.equal(
    response.headers.get("cache-control"),
    "private, no-store, max-age=0",
  );
  const body = (await response.json()) as {
    campaign: { name: string; revision: number };
  };
  assert.equal(body.campaign.name, "Icewind Dale");
  assert.equal(body.campaign.revision, 1);
  database.close();
});

test("v6 API maps invalid input and stale revisions", async () => {
  const database = fixture();
  const created = await handleV6Api(
    request("campaigns", "POST", { name: "Campaign" }),
    database,
    { userId: ownerId, isAdmin: false },
  );
  const { campaign } = (await created.json()) as { campaign: { id: string } };
  const invalid = await handleV6Api(
    request(`campaigns/${campaign.id}/players`, "POST", { name: "Incomplete" }),
    database,
    { userId: ownerId, isAdmin: false },
  );
  assert.equal(invalid.status, 400);

  const playerInput = {
    name: "Shadowheart",
    race: "Half-Elf",
    className: "Cleric",
    level: 5,
    hitPoints: 40,
    armorClass: 18,
    notes: "",
  };
  const playerResponse = await handleV6Api(
    request(`campaigns/${campaign.id}/players`, "POST", playerInput),
    database,
    { userId: ownerId, isAdmin: false },
  );
  const { player } = (await playerResponse.json()) as {
    player: { id: string };
  };
  const first = await handleV6Api(
    request(`campaigns/${campaign.id}/players/${player.id}`, "PATCH", {
      ...playerInput,
      revision: 1,
      level: 6,
    }),
    database,
    { userId: ownerId, isAdmin: false },
  );
  assert.equal(first.status, 200);
  const stale = await handleV6Api(
    request(`campaigns/${campaign.id}/players/${player.id}`, "PATCH", {
      ...playerInput,
      revision: 1,
      level: 7,
    }),
    database,
    { userId: ownerId, isAdmin: false },
  );
  assert.equal(stale.status, 409);
  assert.equal(
    ((await stale.json()) as { code: string }).code,
    "revision_conflict",
  );
  database.close();
});

test("v6 API enforces viewer permissions", async () => {
  const database = fixture();
  const created = await handleV6Api(
    request("campaigns", "POST", { name: "Shared" }),
    database,
    { userId: ownerId, isAdmin: false },
  );
  const { campaign } = (await created.json()) as { campaign: { id: string } };
  await handleV6Api(
    request(`campaigns/${campaign.id}/members`, "POST", {
      username: "viewer",
      role: "viewer",
    }),
    database,
    { userId: ownerId, isAdmin: false },
  );
  const denied = await handleV6Api(
    request(`campaigns/${campaign.id}/sessions`, "POST", {
      title: "No",
      date: "",
      notes: "",
      status: "planned",
      sortOrder: 0,
    }),
    database,
    { userId: viewerId, isAdmin: false },
  );
  assert.equal(denied.status, 403);
  database.close();
});

test("Session Save rolls back encounter updates if the session revision is stale", async () => {
  const database = fixture();
  const context = { userId: ownerId, isAdmin: false };
  const call = (path: string, body: unknown, method = "POST") =>
    handleV6Api(request(path, method, body), database, context);
  const { campaign } = await (
    await call("campaigns", { name: "Atomic" })
  ).json();
  const root = `campaigns/${campaign.id}/sessions`;
  const { session } = await (
    await call(root, {
      title: "Session",
      date: "",
      notes: "",
      status: "planned",
      sortOrder: 0,
    })
  ).json();
  const encounterRoot = `${root}/${session.id}/encounters`;
  const { encounter } = await (
    await call(encounterRoot, {
      name: "Encounter",
      notes: "",
      monsters: [],
      combatants: [],
      sortOrder: 0,
    })
  ).json();
  await call(
    `${root}/${session.id}`,
    { ...session, title: "Other user" },
    "PATCH",
  );
  const stale = await call(`${root}/${session.id}/save`, {
    session: { ...session, title: "My draft" },
    encounters: [{ ...encounter, name: "Changed" }],
  });
  assert.equal(stale.status, 409);
  const unchanged = await (
    await handleV6Api(request(encounterRoot), database, context)
  ).json();
  assert.equal(unchanged.encounters[0].name, "Encounter");
  assert.equal(unchanged.encounters[0].revision, 1);
  const fresh = await (
    await handleV6Api(request(root), database, context)
  ).json();
  const success = await call(`${root}/${session.id}/save`, {
    session: { ...fresh.sessions[0], title: "Together" },
    encounters: [{ ...encounter, name: "Saved together" }],
  });
  assert.equal(success.status, 200);
  const result = await success.json();
  assert.equal(result.session.title, "Together");
  assert.equal(result.encounters[0].name, "Saved together");
  database.close();
});
