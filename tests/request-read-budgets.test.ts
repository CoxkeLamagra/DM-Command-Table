import { createCombatRepository } from "../server/encounters/combat-repository.ts";
import { createContentRepository } from "../server/content/content-repository.ts";
import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { z } from "zod";
import { runMigrations } from "../db/migrations.ts";
import { handleApi } from "../server/api/api-router.ts";
import { createCampaignRepository } from "../server/campaigns/campaign-repository.ts";
import { createBestiaryRepository } from "../server/bestiary/bestiary-repository.ts";
import {
  assertJsonStructure,
  assertJsonTextStructure,
  parseInput,
} from "../server/http/validation.ts";
import { combatSchema } from "../server/http/schemas.ts";
import { apiError } from "../server/http/http.ts";

const owner = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";
const monster = {
  name: "Dragon",
  type: "Dragon",
  challengeRating: "1",
  armorClass: 12,
  hitPoints: 9,
  speed: "30 ft",
  stats: "<p>Stats</p>",
  token: "",
  abilities: "<p>Attack</p>",
  spells: "",
  notes: "<p>Bur<b>ie</b>d &amp; treasure</p>",
  spellSlots: [],
  source: "MM",
  favorite: false,
};
function fixture() {
  const db = new DatabaseSync(":memory:");
  runMigrations(db);
  for (const id of [owner, other])
    db.prepare(
      "INSERT INTO users VALUES(?, 'Assessment', ?, 'unused', 0,1,1)",
    ).run(id, id);
  const campaign = createCampaignRepository(db).create(owner, {
    name: "Budget",
  });
  return { db, campaign };
}
const oversized = (e: unknown) =>
  e instanceof Error && "status" in e && e.status === 413;

test("JSON budgets reject wide, deep and oversized collections before validation without lowering supported format counts", () => {
  assert.throws(
    () => assertJsonStructure(new Array(20001).fill(null)),
    oversized,
  );
  assert.throws(
    () =>
      assertJsonStructure(
        Object.fromEntries(
          Array.from({ length: 257 }, (_, i) => [String(i), 0]),
        ),
      ),
    oversized,
  );
  let deep: unknown = 0;
  for (let i = 0; i < 40; i++) deep = { next: deep };
  assert.throws(() => assertJsonStructure(deep), oversized);
  assert.doesNotThrow(() =>
    assertJsonStructure(
      new Array(20000).fill({ id: owner, name: "Valid import" }),
    ),
  );
  // Below every collection size limit: invalid object elements must fail fast.
  const invalid = {
    revision: 1,
    name: "Combat",
    round: 1,
    turn: 0,
    combatants: new Array(10000).fill({}),
  };
  assert.throws(() => parseInput(combatSchema, invalid), { status: 400 });
});

test("campaign authorization precedes body consumption for every combat mutation", async () => {
  const { db, campaign } = fixture();
  try {
    for (const [method, suffix] of [
      ["PUT", ""],
      ["POST", "/command"],
      ["POST", "/undo"],
      ["POST", "/load-prepared"],
    ]) {
      const request = new Request(
        `http://local/api/campaigns/${campaign.id}/combat${suffix}`,
        {
          method,
          headers: { "content-type": "application/json" },
          body: "invalid json",
        },
      );
      const response = await handleApi(request, db, {
        userId: other,
        isAdmin: false,
      });
      assert.equal(response.status, 403);
      assert.equal(request.bodyUsed, false);
    }
  } finally {
    db.close();
  }
});

test("validation diagnostics project bounded paths and messages instead of raw union/input data", async () => {
  const error = new z.ZodError(
    new Array(100).fill({
      code: "custom",
      message: "X".repeat(10000),
      path: new Array(100).fill("Y".repeat(1000)),
    }),
  );
  const response = apiError(error);
  const body = await response.json();
  assert.equal(response.status, 400);
  assert.equal(body.issues.length, 8);
  assert.ok(JSON.stringify(body).length < 15000);
});

test("paged monster summaries and authorized detail reads retain full content and note search", async () => {
  const { db, campaign } = fixture();
  const bestiary = createBestiaryRepository(db);
  try {
    const ids: string[] = [];
    for (let i = 0; i < 101; i++)
      ids.push(
        bestiary.create(
          campaign.id,
          owner,
          { ...monster, name: `Dragon ${i}` },
          true,
        ).id,
      );
    const first = bestiary.summaries(campaign.id, owner);
    assert.equal(first.monsters.length, 100);
    assert.ok(first.next);
    assert.equal("abilities" in first.monsters[0], false);
    assert.equal("notes" in first.monsters[0], false);
    const second = bestiary.summaries(campaign.id, owner, first.next!);
    assert.equal(second.monsters.length, 1);
    assert.equal(second.next, null);
    assert.equal(
      new Set([...first.monsters, ...second.monsters].map((x) => x.id)).size,
      101,
    );
    assert.equal(
      bestiary.summaries(campaign.id, owner, "", "buried").monsters.length,
      100,
    );
    const detail = bestiary.get(campaign.id, owner, ids[0]);
    assert.equal(detail.abilities, monster.abilities);
    assert.equal(detail.notes, monster.notes);
    const foreign = createCampaignRepository(db).create(other, {
      name: "Other",
    });
    assert.throws(() => bestiary.get(foreign.id, other, ids[0]), {
      name: "ResourceNotFoundError",
    });
    const updated = bestiary.update(
      campaign.id,
      owner,
      detail.id,
      detail.revision,
      { ...detail, favorite: true },
    );
    assert.equal(updated.abilities, monster.abilities);
    assert.equal(updated.notes, monster.notes);
    assert.equal(updated.favorite, true);
    const response = await handleApi(
      new Request(
        `http://local/api/campaigns/${campaign.id}/monsters/${detail.id}`,
      ),
      db,
      { userId: owner, isAdmin: false },
    );
    assert.equal(response.status, 200);
  } finally {
    db.close();
  }
});

test("full monster lists reject repeated shared payloads under constrained heaps; summaries/details and rollback remain usable", () => {
  const base = (p: string) => pathToFileURL(path.resolve(p)).href;
  const code = `import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';
  import {runMigrations} from ${JSON.stringify(base("db/migrations.ts"))};
  import {createBestiaryRepository} from ${JSON.stringify(base("server/bestiary/bestiary-repository.ts"))};
  import {createCampaignRepository} from ${JSON.stringify(base("server/campaigns/campaign-repository.ts"))};
  import {copyCampaign} from ${JSON.stringify(base("server/campaigns/campaign-copy.ts"))};
  import {monsterPayload} from ${JSON.stringify(base("server/bestiary/monster-definitions.ts"))};
  const db=new DatabaseSync(':memory:');runMigrations(db);db.exec("INSERT INTO users VALUES('owner','Owner','owner','unused',0,1,1)");
  const campaign=createCampaignRepository(db).create('owner',{name:'Large'});const bestiary=createBestiaryRepository(db);
  const payload=monsterPayload({...${JSON.stringify(monster)},abilities:'A'.repeat(900000)});const definition=crypto.randomUUID();
  db.prepare('INSERT INTO monster_definitions(id,scope_campaign_id,payload,content_hash) VALUES(?,NULL,?,?)').run(definition,payload,'assessment');
  const insert=db.prepare('INSERT INTO monsters(id,campaign_id,name,definition_id,created_at,updated_at) VALUES(?,?,?,?,1,1)');let first;
  for(let i=0;i<85;i++){const id=crypto.randomUUID();first??=id;insert.run(id,campaign.id,'Dragon',definition);}
  assert.throws(()=>bestiary.list(campaign.id,'owner'),e=>e.status===413);
  assert.equal(bestiary.summaries(campaign.id,'owner').monsters.length,85);
  assert.equal(bestiary.get(campaign.id,'owner',first).abilities.length,900000);
  assert.throws(()=>copyCampaign(db,campaign.id,'owner','campaign'),e=>e.status===413);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM campaigns').get().n,1);
  console.log('bounded rejection, detail, summaries and rollback passed');db.close();`;
  const result = spawnSync(
    process.execPath,
    [
      "--max-old-space-size=128",
      "--max-semi-space-size=16",
      "--experimental-strip-types",
      "--input-type=module",
      "-e",
      code,
    ],
    { encoding: "utf8", timeout: 30000 },
  );
  assert.equal(result.signal, null, result.stderr);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /rollback passed/);
});

test("owned-campaign hostile JSON rejects safely under a constrained heap and valid maximum combat still parses", () => {
  const base = (p: string) => pathToFileURL(path.resolve(p)).href;
  const code = `import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';
  import {runMigrations} from ${JSON.stringify(base("db/migrations.ts"))};
  import {createCampaignRepository} from ${JSON.stringify(base("server/campaigns/campaign-repository.ts"))};
  import {handleApi} from ${JSON.stringify(base("server/api/api-router.ts"))};
  import {parseInput} from ${JSON.stringify(base("server/http/validation.ts"))};
  import {combatSchema} from ${JSON.stringify(base("server/http/schemas.ts"))};
  import {z} from ${JSON.stringify(base("node_modules/zod/index.js"))};
  const db=new DatabaseSync(':memory:');runMigrations(db);db.exec("INSERT INTO users VALUES('owner','Owner','owner','unused',0,1,1)");
  const campaign=createCampaignRepository(db).create('owner',{name:'Hostile'});
  assert.throws(()=>parseInput(z.array(z.array(z.string().min(5)).max(100)).max(20000),Array.from({length:5000},()=>new Array(100).fill('x'))),e=>e.status===400);
  for(const [elements,status] of [[new Array(1500000).fill(null),413],[new Array(10000).fill({}),400]]) {
    const body=JSON.stringify({revision:1,name:'Combat',round:1,turn:0,combatants:elements});
    const response=await handleApi(new Request('http://local/api/campaigns/'+campaign.id+'/combat',{method:'PUT',headers:{'content-type':'application/json'},body}),db,{userId:'owner',isAdmin:false});
    assert.equal(response.status,status);assert.ok((await response.text()).length<2000);
  }
  const entry={id:crypto.randomUUID(),playerId:null,monsterId:null,name:'NPC',displayNumber:1,kind:'npc',notes:'',initiative:1,hitPoints:10,maximumHitPoints:10,armorClass:10,sortOrder:0,conditions:[],revision:1};
  assert.equal(parseInput(combatSchema,{revision:1,name:'Legitimate',round:1,turn:0,combatants:new Array(10000).fill(entry)}).combatants.length,10000);
  console.log('hostile requests rejected; supported combat capacity preserved');db.close();`;
  const result = spawnSync(
    process.execPath,
    [
      "--max-old-space-size=128",
      "--max-semi-space-size=16",
      "--experimental-strip-types",
      "--input-type=module",
      "-e",
      code,
    ],
    { encoding: "utf8", timeout: 30000 },
  );
  assert.equal(result.signal, null, result.stderr);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /capacity preserved/);
});

test("implicit and prepared snapshot expansion charge quantities and roll back rejected saves", async () => {
  const { db, campaign } = fixture();
  try {
    const created = createBestiaryRepository(db).create(campaign.id, owner, {
      ...monster,
      abilities: "A".repeat(900000),
    });
    const repo = createCombatRepository(db),
      before = repo.getCombat(campaign.id, owner);
    const combatants = Array.from({ length: 100 }, (_, i) => ({
      id: crypto.randomUUID(),
      playerId: null,
      monsterId: created.id,
      name: "Dragon",
      displayNumber: i + 1,
      kind: "monster" as const,
      notes: "",
      initiative: 1,
      hitPoints: 9,
      maximumHitPoints: 9,
      armorClass: 12,
      sortOrder: i,
      conditions: [],
      revision: 1,
    }));
    assert.throws(
      () =>
        repo.saveCombat(campaign.id, owner, before.revision, {
          ...before,
          combatants,
        }),
      oversized,
    );
    assert.equal(repo.getCombat(campaign.id, owner).revision, before.revision);
    assert.equal(repo.getCombat(campaign.id, owner).combatants.length, 0);
    const session = createContentRepository(db).createSession(
      campaign.id,
      owner,
      { title: "Budget", date: "", notes: "", status: "planned", sortOrder: 0 },
    );
    const response = await handleApi(
      new Request(
        `http://local/api/campaigns/${campaign.id}/combat/load-prepared`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            revision: before.revision,
            prepared: {
              id: crypto.randomUUID(),
              sessionId: session.id,
              name: "Huge",
              notes: "",
              sortOrder: 0,
              revision: 1,
              createdAt: "",
              updatedAt: "",
              monsters: [
                {
                  id: crypto.randomUUID(),
                  monsterId: created.id,
                  displayNumber: 1,
                  quantity: 100,
                  sortOrder: 0,
                },
              ],
              combatants: [],
            },
          }),
        },
      ),
      db,
      { userId: owner, isAdmin: false },
    );
    assert.equal(response.status, 413);
    assert.equal(repo.getCombat(campaign.id, owner).revision, before.revision);
    const saved = repo.saveCombat(campaign.id, owner, before.revision, {
      ...before,
      combatants: combatants.slice(0, 1),
    });
    assert.equal(saved.combatants[0].snapshot?.abilities.length, 900000);
  } finally {
    db.close();
  }
});

test("encoded JSON structure is rejected before allocation and quoted delimiters remain opaque", () => {
  assert.throws(
    () =>
      assertJsonTextStructure(
        "{" +
          Array.from(
            { length: 257 },
            (_, i) => JSON.stringify("key" + i) + ":null",
          ).join(",") +
          "}",
      ),
    oversized,
  );
  assert.throws(
    () => assertJsonTextStructure("[" + "null,".repeat(20000) + "null]"),
    oversized,
  );
  assert.throws(
    () =>
      assertJsonTextStructure(
        "{" + '"same":null,'.repeat(256) + '"same":null}',
      ),
    oversized,
  );
  assert.throws(
    () => assertJsonTextStructure("[".repeat(40) + "0" + "]".repeat(40)),
    oversized,
  );
  const value = {
    notes: '\\" ' + "[{:,}]".repeat(30000),
    allowed: [true, false, null, 1, -1, "text", { key: [] }],
  };
  assert.doesNotThrow(() => assertJsonTextStructure(JSON.stringify(value)));
});
