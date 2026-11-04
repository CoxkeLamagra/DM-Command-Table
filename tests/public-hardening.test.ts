import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  publicOrigin,
  permittedPublicRequest,
} from "../server/security/public-origin.ts";
import { shouldUseSecureCookie } from "../server/security/cookies.ts";
import { apiHandler } from "../server/http/api-handler.ts";
import { rejectCrossOrigin } from "../server/http/origin.ts";
import { checkMultipartEnvelope } from "../server/http/multipart.ts";
import { withBodyActor, readRequestBody } from "../server/http/body-reader.ts";
import { enforceRateLimit } from "../server/http/request-security.ts";
import { clientAddress } from "../server/security/rate-limit.ts";
import { runMigrations } from "../db/migrations.ts";
import {
  createSessionRecord,
  userForCredential,
} from "../server/identity/auth.ts";
import { createBestiaryRepository } from "../server/bestiary/bestiary-repository.ts";
import { createCampaignRepository } from "../server/campaigns/campaign-repository.ts";

function streamed(stream: ReadableStream<Uint8Array>, signal?: AbortSignal) {
  return new Request("http://local", {
    method: "POST",
    body: stream,
    duplex: "half",
    signal,
  } as RequestInit);
}

test("public profile pins one HTTPS identity, rejects forwarding-header aliases and forces secure cookies", () => {
  const previous = process.env.DM_COMMAND_TABLE_PUBLIC_ORIGIN;
  try {
    for (const value of [
      "http://dm.example",
      "https://user:secret@dm.example",
      "https://dm.example/path",
      "https://dm.example?x=1",
      "not a url",
    ])
      assert.throws(() => publicOrigin(value));
    process.env.DM_COMMAND_TABLE_PUBLIC_ORIGIN = "https://dm.example";
    assert.equal(shouldUseSecureCookie("never", new Headers(), false), true);
    const good = new Headers({
      host: "dm.example",
      origin: "https://dm.example",
    });
    assert.equal(permittedPublicRequest(good, "/api/account"), true);
    for (const headers of [
      new Headers({
        host: "evil.example",
        "x-forwarded-host": "dm.example",
        origin: "https://dm.example",
      }),
      new Headers({ host: "dm.example", origin: "http://dm.example" }),
      new Headers({ host: "dm.example", origin: "null" }),
    ])
      assert.equal(permittedPublicRequest(headers, "/api/account"), false);
    assert.equal(
      permittedPublicRequest(
        new Headers({ host: "127.0.0.1:3000" }),
        "/api/health",
      ),
      true,
    );
    assert.equal(
      permittedPublicRequest(
        new Headers({ host: "127.0.0.1:3000" }),
        "/api/auth",
      ),
      false,
    );
    assert.equal(
      rejectCrossOrigin(
        new Request("http://internal/api/account", { headers: good }),
      ),
      null,
    );
    assert.equal(
      rejectCrossOrigin(
        new Request("http://internal/api/account", {
          headers: { host: "dm.example", origin: "http://dm.example" },
        }),
      )?.status,
      403,
    );
    delete process.env.DM_COMMAND_TABLE_PUBLIC_ORIGIN;
    assert.equal(permittedPublicRequest(new Headers(), "/api/auth"), true);
    assert.equal(shouldUseSecureCookie("never", new Headers(), false), false);
  } finally {
    if (previous === undefined)
      delete process.env.DM_COMMAND_TABLE_PUBLIC_ORIGIN;
    else process.env.DM_COMMAND_TABLE_PUBLIC_ORIGIN = previous;
  }
});

test("body admission rejects excess readers and releases admission/stream locks on success, timeout and abort", async () => {
  const holders: ReadableStreamDefaultController<Uint8Array>[] = [];
  const streams = Array.from(
    { length: 8 },
    () =>
      new ReadableStream<Uint8Array>({
        start(controller) {
          holders.push(controller);
        },
      }),
  );
  const reading = streams.map((stream) =>
    readRequestBody(streamed(stream), 1024, 1000),
  );
  try {
    await assert.rejects(
      readRequestBody(
        new Request("http://local", { method: "POST", body: "ok" }),
        1024,
      ),
      { status: 503 },
    );
  } finally {
    holders.forEach((controller) => controller.close());
    await Promise.all(reading);
  }
  assert.ok(streams.every((stream) => !stream.locked));
  let cancelled = false;
  const slow = new ReadableStream<Uint8Array>({
    cancel() {
      cancelled = true;
    },
  });
  await assert.rejects(readRequestBody(streamed(slow), 1024, 10), {
    status: 408,
  });
  assert.equal(cancelled, true);
  assert.equal(slow.locked, false);
  const controller = new AbortController();
  const aborted = new ReadableStream<Uint8Array>();
  const pending = readRequestBody(streamed(aborted, controller.signal), 1024);
  controller.abort();
  await assert.rejects(pending, { status: 400 });
  assert.equal(aborted.locked, false);
  assert.equal(
    new TextDecoder().decode(
      await readRequestBody(
        new Request("http://local", { method: "POST", body: "ok" }),
        1024,
      ),
    ),
    "ok",
  );
});

test("body reservations reject concurrent large readers and enforce actual chunk bytes even without content length", async () => {
  let close!: () => void;
  const held = new ReadableStream<Uint8Array>({
    start(controller) {
      close = () => controller.close();
    },
  });
  const first = readRequestBody(streamed(held), 50 * 1024 * 1024, 1000);
  try {
    await assert.rejects(
      readRequestBody(
        new Request("http://local", { method: "POST", body: "x" }),
        50 * 1024 * 1024,
      ),
      { status: 503 },
    );
  } finally {
    close();
    await first;
  }
  let cancelled = false;
  const oversized = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array(100));
    },
    cancel() {
      cancelled = true;
    },
  });
  await assert.rejects(readRequestBody(streamed(oversized), 10), {
    status: 413,
  });
  assert.equal(cancelled, true);
  assert.equal(oversized.locked, false);
});

test("authenticated limits follow the account across IP changes; malformed forwarding identities share a bounded bucket", () => {
  const db = new DatabaseSync(":memory:");
  runMigrations(db);
  const previous = process.env.DM_COMMAND_TABLE_TRUST_PROXY;
  try {
    process.env.DM_COMMAND_TABLE_TRUST_PROXY = "true";
    for (let i = 0; i < 2; i++)
      assert.equal(
        enforceRateLimit(
          db,
          new Request("http://local", {
            headers: { "x-real-ip": `192.0.2.${i + 1}` },
          }),
          "write",
          "account",
          2,
          60000,
        ),
        null,
      );
    assert.equal(
      enforceRateLimit(
        db,
        new Request("http://local", { headers: { "x-real-ip": "192.0.2.9" } }),
        "write",
        "account",
        2,
        60000,
      )?.status,
      429,
    );
    assert.equal(
      enforceRateLimit(
        db,
        new Request("http://local"),
        "write",
        "other-account",
        2,
        60000,
      ),
      null,
    );
    for (const address of [
      "arbitrary-one",
      "arbitrary-two",
      "198.51.100.1, 127.0.0.1",
    ])
      assert.equal(
        clientAddress(
          new Request("http://local", { headers: { "x-real-ip": address } }),
        ),
        "unknown",
      );
  } finally {
    db.close();
    if (previous === undefined) delete process.env.DM_COMMAND_TABLE_TRUST_PROXY;
    else process.env.DM_COMMAND_TABLE_TRUST_PROXY = previous;
  }
});

test("session issuance caps active sessions, retains the newest even at tied timestamps and isolates accounts", () => {
  const db = new DatabaseSync(":memory:");
  runMigrations(db);
  try {
    db.exec(
      "INSERT INTO users VALUES('owner','Owner','owner','credential',0,1,1),('other','Other','other','credential',0,1,1)",
    );
    const user = userForCredential(db, "owner", "credential")!;
    const other = createSessionRecord(
      userForCredential(db, "other", "credential")!,
      db,
      1000,
    );
    let newest = "";
    for (let i = 0; i < 25; i++)
      newest = createSessionRecord(user, db, 1000).token;
    assert.equal(
      db
        .prepare(
          "SELECT COUNT(*) AS n FROM local_sessions WHERE user_id='owner'",
        )
        .get()!.n,
      20,
    );
    for (const token of [newest, other.token])
      assert.ok(
        db
          .prepare("SELECT 1 FROM local_sessions WHERE token_hash=?")
          .get(createHash("sha256").update(token).digest("hex")),
      );
  } finally {
    db.close();
  }
});

test("search pages advance over unmatched batches instead of scanning unbounded notes in one request", () => {
  const db = new DatabaseSync(":memory:");
  runMigrations(db);
  db.exec("INSERT INTO users VALUES('owner','Owner','owner','unused',0,1,1)");
  try {
    const campaign = createCampaignRepository(db).create("owner", {
        name: "Paged",
      }),
      bestiary = createBestiaryRepository(db);
    const monster = {
      name: "Dragon",
      type: "Dragon",
      challengeRating: "1",
      hitPoints: 5,
      armorClass: 10,
      speed: "",
      stats: "",
      abilities: "",
      spells: "",
      notes: "ordinary",
      spellSlots: [],
      source: "MM",
      favorite: false,
    };
    for (let i = 0; i < 101; i++)
      bestiary.create(campaign.id, "owner", monster, true);
    const ids = db
      .prepare("SELECT id FROM monsters WHERE campaign_id=? ORDER BY id")
      .all(campaign.id) as { id: string }[];
    const item = bestiary.get(campaign.id, "owner", ids[100].id);
    bestiary.update(campaign.id, "owner", item.id, item.revision, {
      ...item,
      notes: "<p>Needle</p>",
    });
    const first = bestiary.summaries(campaign.id, "owner", "", "needle");
    assert.equal(first.monsters.length, 0);
    assert.ok(first.next);
    const second = bestiary.summaries(
      campaign.id,
      "owner",
      first.next!,
      "needle",
    );
    assert.equal(second.monsters.length, 1);
    assert.equal(second.monsters[0].id, item.id);
    assert.equal(second.next, null);
  } finally {
    db.close();
  }
});

test("content, preparations and combat collection reads reject excessive persisted content before materialization on small heaps", () => {
  const uri = (file: string) => pathToFileURL(path.resolve(file)).href;
  const code = `import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';
  import {runMigrations} from ${JSON.stringify(uri("db/migrations.ts"))};
  import {createCampaignRepository} from ${JSON.stringify(uri("server/campaigns/campaign-repository.ts"))};
  import {createContentRepository} from ${JSON.stringify(uri("server/content/content-repository.ts"))};
  import {createEncounterRepository} from ${JSON.stringify(uri("server/encounters/encounter-repository.ts"))};
  const db=new DatabaseSync(':memory:');runMigrations(db);db.exec("INSERT INTO users VALUES('owner','Owner','owner','unused',0,1,1)");
  const c=createCampaignRepository(db).create('owner',{name:'Large'}), content=createContentRepository(db), enc=createEncounterRepository(db);
  const p=content.createPlayer(c.id,'owner',{name:'P',race:'',className:'',level:1,hitPoints:10,armorClass:10,notes:''});
  const s=content.createSession(c.id,'owner',{title:'S',date:'',notes:'',status:'planned',sortOrder:0});
  const story=content.createStoryBeat(c.id,'owner',{title:'Story',chapter:'',details:'',status:'planned',sortOrder:0,sessionIds:[]});
  const prepared=enc.createPrepared(c.id,'owner',s.id,{name:'Prepared',notes:'',sortOrder:0,monsters:[],combatants:[]});
  for(const [table,field,id,read] of [['players','notes',p.id,()=>content.listPlayers(c.id,'owner')],['sessions','notes',s.id,()=>content.listSessions(c.id,'owner')],['story_beats','details',story.id,()=>content.listStory(c.id,'owner')],['prepared_encounters','notes',prepared.id,()=>enc.listPrepared(c.id,'owner',s.id)]]) {
    // Existing supported storage may already be over budget; it must reject safely.
    db.prepare('UPDATE '+table+' SET '+field+'=? WHERE id=?').run('A'.repeat(30000000),id);
    assert.throws(read,e=>e.status===413);
    db.prepare('UPDATE '+table+' SET '+field+"='' WHERE id=?").run(id);
    assert.equal(read().length,1);
  }
  const combat=enc.getCombat(c.id,'owner');
  const entry={id:crypto.randomUUID(),playerId:null,monsterId:null,name:'NPC',displayNumber:1,kind:'npc',notes:'',initiative:1,hitPoints:5,maximumHitPoints:5,armorClass:10,sortOrder:0,conditions:[],revision:1};
  enc.saveCombat(c.id,'owner',combat.revision,{...combat,combatants:[entry]});
  db.prepare('UPDATE combatants SET notes=? WHERE id=?').run('A'.repeat(30000000),entry.id);
  assert.throws(()=>enc.getCombat(c.id,'owner'),e=>e.status===413);
  db.prepare("UPDATE combatants SET notes='' WHERE id=?").run(entry.id);
  assert.equal(enc.getCombat(c.id,'owner').combatants.length,1);
  db.close();console.log('collection reads bounded and normal reads preserved');`;
  const result = spawnSync(
    process.execPath,
    [
      "--max-old-space-size=128",
      "--experimental-strip-types",
      "--input-type=module",
      "-e",
      code,
    ],
    { encoding: "utf8", timeout: 30000 },
  );
  assert.equal(result.signal, null, result.stderr);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /normal reads preserved/);
});

test("many tiny body chunks do not accumulate chunk arrays or deadline listeners", async () => {
  let remaining = 100000;
  const tiny = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (remaining--) controller.enqueue(new Uint8Array([7]));
      else controller.close();
    },
  });
  const bytes = await readRequestBody(streamed(tiny), 100000);
  assert.equal(bytes.length, 100000);
  assert.ok(bytes.every((byte) => byte === 7));
  assert.equal(tiny.locked, false);
});

test("one authenticated actor cannot occupy every body reader and another actor can progress", async () => {
  const closers: (() => void)[] = [];
  const hold = () =>
    new ReadableStream<Uint8Array>({
      start(controller) {
        closers.push(() => controller.close());
      },
    });
  const a = withBodyActor("a", () => readRequestBody(streamed(hold()), 1024));
  const b = withBodyActor("a", () => readRequestBody(streamed(hold()), 1024));
  try {
    await assert.rejects(
      withBodyActor("a", () =>
        readRequestBody(
          new Request("http://local", { method: "POST", body: "x" }),
          1024,
        ),
      ),
      { status: 503 },
    );
    assert.equal(
      (
        await withBodyActor("b", () =>
          readRequestBody(
            new Request("http://local", { method: "POST", body: "x" }),
            1024,
          ),
        )
      ).length,
      1,
    );
  } finally {
    closers.forEach((close) => close());
    await Promise.all([a, b]);
  }
});

test("multipart admission bounds fields and headers before generic parsing, preserving binary marker-like bytes", () => {
  const contentType = 'multipart/form-data; boundary="test-boundary"';
  const field = (name: string, body: string) =>
    '--test-boundary\r\nContent-Disposition: form-data; name="' +
    name +
    '"\r\n\r\n' +
    body +
    "\r\n";
  const valid =
    field("file", "binary\r\n--test-boundary-not-a-delimiter") +
    field("deduplicateToken", "true") +
    "--test-boundary--\r\n";
  assert.doesNotThrow(() =>
    checkMultipartEnvelope(Buffer.from(valid), contentType),
  );
  assert.throws(
    () =>
      checkMultipartEnvelope(
        Buffer.from(
          field("one", "x") +
            field("two", "x") +
            field("three", "x") +
            "--test-boundary--",
        ),
        contentType,
      ),
    { status: 413 },
  );
  assert.throws(
    () =>
      checkMultipartEnvelope(
        Buffer.from(
          "--test-boundary\r\n" +
            "X".repeat(9000) +
            "\r\n\r\nx\r\n--test-boundary--",
        ),
        contentType,
      ),
    { status: 400 },
  );
  assert.throws(
    () =>
      checkMultipartEnvelope(
        Buffer.from(valid),
        'multipart/form-data; boundary="bad\nvalue"',
      ),
    { status: 400 },
  );
  assert.throws(
    () =>
      checkMultipartEnvelope(
        Buffer.from(valid),
        contentType + "; boundary=other",
      ),
    { status: 400 },
  );
  assert.throws(
    () =>
      checkMultipartEnvelope(
        Buffer.from(valid + "--test-boundary\r\nextra"),
        contentType,
      ),
    { status: 400 },
  );
});

test("API guard applies public identity and browser mutation checks before handling, including OPTIONS", async () => {
  const previous = process.env.DM_COMMAND_TABLE_PUBLIC_ORIGIN;
  let handled = 0;
  try {
    process.env.DM_COMMAND_TABLE_PUBLIC_ORIGIN = "https://dm.example";
    const guarded = apiHandler(() => {
      handled++;
      return new Response(null, { status: 204 });
    });
    for (const method of ["GET", "POST", "OPTIONS"]) {
      const result = await guarded(
        new Request("http://internal/api/auth", {
          method,
          headers: { host: "evil.example", "x-forwarded-host": "dm.example" },
        }),
      );
      assert.equal(result.status, 403);
    }
    assert.equal(
      (
        await guarded(
          new Request("http://internal/api/auth", {
            method: "POST",
            headers: { host: "dm.example", "sec-fetch-site": "cross-site" },
          }),
        )
      ).status,
      403,
    );
    assert.equal(handled, 0);
    const accepted = await guarded(
      new Request("http://internal/api/auth", {
        method: "OPTIONS",
        headers: { host: "dm.example", origin: "https://dm.example" },
      }),
    );
    assert.equal(accepted.status, 204);
    assert.equal(
      accepted.headers.get("Strict-Transport-Security"),
      "max-age=15552000",
    );
    assert.equal(handled, 1);
  } finally {
    if (previous === undefined)
      delete process.env.DM_COMMAND_TABLE_PUBLIC_ORIGIN;
    else process.env.DM_COMMAND_TABLE_PUBLIC_ORIGIN = previous;
  }
});
