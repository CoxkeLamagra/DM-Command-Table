import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import {
  copyFileSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { runMigrations } from "../db/migrations.ts";
import { handleApi } from "../server/api/api-router.ts";

// Locks the observable behaviour of every catch-all API path x method x role:
// the status code and the top-level JSON keys of the response. Any routing,
// permission or dispatch change that alters one of these fails this test.
// Regenerate deliberately with UPDATE_API_ROUTE_MATRIX=1 only when a change in
// API behaviour is intended, and review the diff.
const expectedFile = path.resolve("tests/fixtures/api-route-matrix.json");

const ids = {
  owner: "10000000-0000-4000-8000-000000000001",
  editor: "10000000-0000-4000-8000-000000000002",
  viewer: "10000000-0000-4000-8000-000000000003",
  outsider: "10000000-0000-4000-8000-000000000004",
  newbie: "10000000-0000-4000-8000-000000000005",
  missing: "10000000-0000-4000-8000-0000000000ff",
};
const roles = ["owner", "editor", "viewer", "outsider"] as const;
const methods = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;

type Seed = Record<"C" | "P" | "M" | "S" | "E" | "B" | "T", string>;

function call(
  database: DatabaseSync,
  userId: string,
  method: string,
  pathname: string,
  body?: unknown,
) {
  return handleApi(
    new Request(`http://localhost/api/${pathname}`, {
      method,
      headers:
        body === undefined ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
    database,
    { userId, isAdmin: false },
  );
}

async function created<T>(response: Promise<Response>, key: string) {
  const value = await response;
  assert.ok(value.status < 300, `seed ${key} failed with ${value.status}`);
  return ((await value.json()) as Record<string, T>)[key];
}

const player = {
  kind: "player",
  name: "Shadowheart",
  race: "Half-Elf",
  className: "Cleric",
  level: 5,
  hitPoints: 40,
  armorClass: 18,
  notes: "<p>notes</p>",
};
const monster = {
  name: "Goblin",
  type: "humanoid",
  challengeRating: "1/4",
  armorClass: 15,
  hitPoints: 7,
  speed: "30 ft.",
  stats: "",
  token: "",
  abilities: "",
  spells: "",
  notes: "",
  spellSlots: [],
  source: null,
  favorite: false,
};
const session = {
  title: "Session 1",
  date: "2026-01-01",
  notes: "",
  status: "planned",
  sortOrder: 0,
};
const story = {
  title: "Beat",
  chapter: "One",
  details: "",
  status: "planned",
  sortOrder: 0,
  sessionIds: [],
};
const encounter = (
  monsterId: string,
  entryId = "20000000-0000-4000-8000-000000000001",
) => ({
  name: "Ambush",
  notes: "",
  sortOrder: 0,
  monsters: [
    {
      id: entryId,
      monsterId,
      displayNumber: null,
      quantity: 2,
      sortOrder: 0,
    },
  ],
  combatants: [],
});

async function seedTemplate(file: string): Promise<Seed> {
  const database = new DatabaseSync(file);
  database.exec("PRAGMA foreign_keys = ON");
  runMigrations(database);
  const insert = database.prepare(
    "INSERT INTO users (id, display_name, username, password_hash, is_admin, created_at, updated_at) VALUES (?, ?, ?, 'hash', 0, 1, 1)",
  );
  for (const name of ["owner", "editor", "viewer", "outsider", "newbie"])
    insert.run(ids[name as keyof typeof ids], name, name);
  const owner = ids.owner;
  const campaign = await created<{ id: string }>(
    call(database, owner, "POST", "campaigns", { name: "Matrix" }),
    "campaign",
  );
  const C = campaign.id;
  for (const [name, role] of [
    ["editor", "editor"],
    ["viewer", "viewer"],
  ])
    await created(
      call(database, owner, "POST", `campaigns/${C}/members`, {
        username: name,
        role,
      }),
      "members",
    );
  const P = (
    await created<{ id: string }>(
      call(database, owner, "POST", `campaigns/${C}/players`, player),
      "player",
    )
  ).id;
  const M = (
    await created<{ id: string }>(
      call(database, owner, "POST", `campaigns/${C}/monsters`, monster),
      "monster",
    )
  ).id;
  const S = (
    await created<{ id: string }>(
      call(database, owner, "POST", `campaigns/${C}/sessions`, session),
      "session",
    )
  ).id;
  const E = (
    await created<{ id: string }>(
      call(
        database,
        owner,
        "POST",
        `campaigns/${C}/sessions/${S}/encounters`,
        encounter(M),
      ),
      "encounter",
    )
  ).id;
  const B = (
    await created<{ id: string }>(
      call(database, owner, "POST", `campaigns/${C}/story`, story),
      "beat",
    )
  ).id;
  const T = (
    await created<{ id: string }>(
      call(database, owner, "POST", "templates", {
        name: "Template",
        content: "<p>t</p>",
      }),
      "template",
    )
  ).id;
  await created(
    call(database, owner, "GET", `campaigns/${C}/combat`),
    "combat",
  );
  database.close();
  return { C, P, M, S, E, B, T };
}

// Path templates: C campaign, P player, M monster, S session, E encounter,
// B story beat, T template, U editor user, X missing id.
const paths = [
  "templates",
  "templates/T",
  "templates/T/extra",
  "campaigns",
  "campaigns/import",
  "campaigns/import/extra",
  "campaigns/C",
  "campaigns/X",
  "campaigns/not-a-uuid",
  "campaigns/C/export",
  "campaigns/C/export/extra",
  "campaigns/C/package",
  "campaigns/C/search",
  "campaigns/C/copy",
  "campaigns/C/members",
  "campaigns/C/members/transfer",
  "campaigns/C/members/U",
  "campaigns/C/members/U/extra",
  "campaigns/C/combat",
  "campaigns/C/combat/command",
  "campaigns/C/combat/undo",
  "campaigns/C/combat/load-prepared",
  "campaigns/C/combat/other",
  "campaigns/C/players",
  "campaigns/C/players/P",
  "campaigns/C/players/X",
  "campaigns/C/players/bulk-delete",
  "campaigns/C/players/P/extra",
  "campaigns/C/monsters",
  "campaigns/C/monsters/M",
  "campaigns/C/monsters/bulk-delete",
  "campaigns/C/monsters/M/extra",
  "campaigns/C/sessions",
  "campaigns/C/sessions/S",
  "campaigns/C/sessions/bulk-delete",
  "campaigns/C/sessions/S/save",
  "campaigns/C/sessions/S/other",
  "campaigns/C/sessions/S/encounters",
  "campaigns/C/sessions/S/encounters/E",
  "campaigns/C/sessions/X/encounters/E",
  "campaigns/C/sessions/S/encounters/reorder",
  "campaigns/C/sessions/S/encounters/E/extra",
  "campaigns/C/story",
  "campaigns/C/story/B",
  "campaigns/C/story/bulk-delete",
  "campaigns/C/unknown",
  "unknown",
];

function resolve(template: string, seed: Seed): string {
  return template
    .split("/")
    .map((part) =>
      part === "U"
        ? ids.editor
        : part === "X"
          ? ids.missing
          : part in seed
            ? seed[part as keyof Seed]
            : part,
    )
    .join("/");
}

function body(template: string, method: string, seed: Seed): unknown {
  if (method === "GET" || method === "DELETE") return undefined;
  const route = `${method} ${template}`;
  const bodies: Record<string, unknown> = {
    "POST templates": { name: "New", content: "" },
    "POST campaigns": { name: "New" },
    "POST campaigns/import": { format: "unknown" },
    "PATCH campaigns/C": { revision: 1, name: "Renamed" },
    "POST campaigns/C/copy": { mode: "campaign" },
    "POST campaigns/C/members": { username: "newbie", role: "viewer" },
    "POST campaigns/C/members/transfer": { userId: ids.editor },
    "PUT campaigns/C/combat": {
      revision: 1,
      name: "Combat",
      round: 1,
      turn: 0,
      combatants: [],
    },
    "POST campaigns/C/combat/command": {
      command: "reset-rounds",
      combat: {
        revision: 1,
        name: "Combat",
        round: 1,
        turn: 0,
        combatants: [],
      },
    },
    "POST campaigns/C/combat/undo": { revision: 1 },
    "POST campaigns/C/players": player,
    "PATCH campaigns/C/players/P": { ...player, revision: 1 },
    "PATCH campaigns/C/players/X": { ...player, revision: 1 },
    "POST campaigns/C/players/bulk-delete": { ids: [seed.P] },
    "POST campaigns/C/monsters": monster,
    "PATCH campaigns/C/monsters/M": { ...monster, revision: 1 },
    "POST campaigns/C/monsters/bulk-delete": { ids: [seed.M] },
    "POST campaigns/C/sessions": session,
    "PATCH campaigns/C/sessions/S": { ...session, revision: 1 },
    "POST campaigns/C/sessions/S/save": {
      session: { ...session, revision: 1 },
      encounters: [],
    },
    "POST campaigns/C/sessions/S/encounters": encounter(
      seed.M,
      "20000000-0000-4000-8000-000000000002",
    ),
    "PATCH campaigns/C/sessions/S/encounters/E": {
      ...encounter(seed.M),
      revision: 1,
    },
    "PATCH campaigns/C/sessions/X/encounters/E": {
      ...encounter(seed.M),
      revision: 1,
    },
    "POST campaigns/C/sessions/S/encounters/reorder": {
      order: [{ id: seed.E, revision: 1 }],
    },
    "POST campaigns/C/story": story,
    "PATCH campaigns/C/story/B": { ...story, revision: 1 },
  };
  return route in bodies ? bodies[route] : {};
}

async function observe(): Promise<Record<string, string>> {
  const dir = mkdtempSync(path.join(tmpdir(), "dmct-route-matrix-"));
  try {
    const template = path.join(dir, "template.sqlite");
    const seed = await seedTemplate(template);
    const observed: Record<string, string> = {};
    let index = 0;
    for (const role of roles)
      for (const pathTemplate of paths)
        for (const method of methods) {
          const file = path.join(dir, `case-${index++}.sqlite`);
          copyFileSync(template, file);
          const database = new DatabaseSync(file);
          database.exec("PRAGMA foreign_keys = ON");
          try {
            const response = await call(
              database,
              ids[role],
              method,
              resolve(pathTemplate, seed),
              body(pathTemplate, method, seed),
            );
            const value = (await response.json().catch(() => null)) as Record<
              string,
              unknown
            > | null;
            const keys =
              value && typeof value === "object" && !Array.isArray(value)
                ? Object.keys(value).sort().join(",")
                : String(value);
            observed[`${role} ${method} ${pathTemplate}`] =
              `${response.status} ${keys}`;
          } finally {
            database.close();
            rmSync(file, { force: true });
            rmSync(`${file}-wal`, { force: true });
            rmSync(`${file}-shm`, { force: true });
          }
        }
    return observed;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("every API path, method and campaign role keeps its status and response shape", async () => {
  const observed = await observe();
  if (process.env.UPDATE_API_ROUTE_MATRIX === "1")
    writeFileSync(expectedFile, JSON.stringify(observed, null, 2) + "\n");
  const expected = JSON.parse(readFileSync(expectedFile, "utf8")) as Record<
    string,
    string
  >;
  const differences = Object.keys({ ...expected, ...observed })
    .filter((key) => expected[key] !== observed[key])
    .map(
      (key) =>
        `${key}: expected ${expected[key] ?? "(none)"}, got ${observed[key] ?? "(none)"}`,
    );
  assert.deepEqual(differences, []);
});
