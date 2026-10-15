import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { scryptSync } from "node:crypto";
import { parseApiRoute } from "../server/http/api-route.ts";
import { isPackageWork, withPackageWork } from "../server/http/package-work.ts";
import { shouldUseSecureCookie } from "../server/security/cookies.ts";
import { runTransaction } from "../db/transaction.ts";
import { runMigrations } from "../db/migrations.ts";
import { createCampaignRepository } from "../server/campaigns/campaign-repository.ts";
import { createBestiaryRepository } from "../server/bestiary/bestiary-repository.ts";
import { createContentRepository } from "../server/content/content-repository.ts";
import {
  authenticateUser,
  createSessionRecord,
} from "../server/identity/auth.ts";
import { verifyPassword } from "../server/security/passwords.ts";

test("equivalent routes share import and package admission; ambiguous aliases reject", async () => {
  const imports = [
    "/api/campaigns/import",
    "/api/%63ampaigns/%69mport",
    "/api//campaigns/import/",
    "/api/campaigns/im%70ort",
  ];
  let release!: () => void;
  const hold = new Promise<void>((resolve) => {
    release = resolve;
  });
  const a = withPackageWork(() => hold),
    b = withPackageWork(() => hold);
  try {
    for (const path of imports) {
      assert.equal(parseApiRoute(path).isImport, true);
      assert.equal(isPackageWork(path), true);
      await assert.rejects(
        withPackageWork(async () => path),
        { status: 503 },
      );
    }
    assert.equal(isPackageWork("/api/%63ampaigns/id/%70ackage"), true);
    for (const path of [
      "/api/campaigns/import/extra",
      "/api/campaigns/id/package/extra",
      "/api/campaigns/%2569mport",
      "/api/campaigns%2fimport",
      "/api/campaigns/%zz",
      "/api/campaigns/%5cimport",
    ])
      assert.throws(() => parseApiRoute(path), { status: 400 });
    assert.equal(
      parseApiRoute("/api/campaigns/id/combat").isPackageWork,
      false,
    );
  } finally {
    release();
    await Promise.all([a, b]);
  }
});

test("secure cookie auto mode supports HTTPS origins through an HTTP proxy hop and HTTP LAN", () => {
  const headers = new Headers({
    host: "dm.example",
    origin: "https://dm.example",
    "x-forwarded-proto": "http",
  });
  assert.equal(shouldUseSecureCookie("auto", headers, true), true);
  assert.equal(shouldUseSecureCookie("auto", headers, false), true);
  headers.set("origin", "http://dm.example");
  assert.equal(shouldUseSecureCookie("auto", headers, true), false);
  headers.set("origin", "https://attacker.example");
  assert.equal(shouldUseSecureCookie("auto", headers, false), false);
  headers.delete("origin");
  headers.set("x-forwarded-proto", "http, https");
  assert.equal(shouldUseSecureCookie("auto", headers, true), false);
  headers.set("x-forwarded-proto", "https");
  assert.equal(shouldUseSecureCookie("auto", headers, true), true);
  assert.equal(shouldUseSecureCookie("auto", headers, false), false);
  assert.equal(shouldUseSecureCookie("always", headers, false), true);
  assert.equal(shouldUseSecureCookie("never", headers, true), false);
});

test("database growth rolls back at budget while oversized data can still be removed", () => {
  const previous = process.env.DM_COMMAND_TABLE_DATABASE_LIMIT_MB;
  const db = new DatabaseSync(":memory:");
  db.exec("CREATE TABLE content(value BLOB)");
  process.env.DM_COMMAND_TABLE_DATABASE_LIMIT_MB = "1";
  try {
    assert.throws(
      () =>
        runTransaction(db, () =>
          db.prepare("INSERT INTO content VALUES(zeroblob(2000000))").run(),
        ),
      { status: 413 },
    );
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM content").get()!.n, 0);
    db.exec("INSERT INTO content VALUES(zeroblob(2000000))");
    runTransaction(db, () => db.exec("DELETE FROM content"));
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM content").get()!.n, 0);
  } finally {
    db.close();
    if (previous === undefined)
      delete process.env.DM_COMMAND_TABLE_DATABASE_LIMIT_MB;
    else process.env.DM_COMMAND_TABLE_DATABASE_LIMIT_MB = previous;
  }
});

test("account quotas reject creation atomically and allow cleanup", () => {
  const saved = [
    process.env.DM_COMMAND_TABLE_CAMPAIGNS_PER_ACCOUNT,
    process.env.DM_COMMAND_TABLE_RECORDS_PER_ACCOUNT,
  ];
  process.env.DM_COMMAND_TABLE_CAMPAIGNS_PER_ACCOUNT = "1";
  process.env.DM_COMMAND_TABLE_RECORDS_PER_ACCOUNT = "1";
  const db = new DatabaseSync(":memory:");
  runMigrations(db);
  db.exec("INSERT INTO users VALUES('owner','Owner','owner','unused',1,1,1)");
  try {
    const campaigns = createCampaignRepository(db),
      content = createContentRepository(db);
    const campaign = campaigns.create("owner", { name: "One" });
    assert.throws(() => campaigns.create("owner", { name: "Two" }), {
      status: 413,
    });
    const input = {
      kind: "player" as const,
      name: "Hero",
      race: "",
      className: "",
      level: null,
      hitPoints: null,
      armorClass: null,
      notes: "",
    };
    const player = content.createPlayer(campaign.id, "owner", input);
    assert.throws(() => content.createPlayer(campaign.id, "owner", input), {
      status: 413,
    });
    assert.equal(content.listPlayers(campaign.id, "owner").length, 1);
    const bestiary = createBestiaryRepository(db);
    assert.throws(
      () => bestiary.createTag(campaign.id, "owner", { name: "Extra" }),
      { status: 413 },
    );
    assert.equal(bestiary.listTags(campaign.id, "owner").length, 0);
    content.deletePlayer(campaign.id, "owner", player.id);
    content.createPlayer(campaign.id, "owner", input);
    assert.equal(campaigns.list("owner").length, 1);
  } finally {
    db.close();
    for (const [i, key] of [
      "DM_COMMAND_TABLE_CAMPAIGNS_PER_ACCOUNT",
      "DM_COMMAND_TABLE_RECORDS_PER_ACCOUNT",
    ].entries())
      if (saved[i] === undefined) delete process.env[key];
      else process.env[key] = saved[i];
  }
});

test("legacy passwords upgrade after valid login and preserve session credential evidence", async () => {
  const db = new DatabaseSync(":memory:");
  runMigrations(db);
  const salt = Buffer.alloc(16, 3),
    hash = scryptSync("legacy-password", salt, 64, { N: 16384, r: 8, p: 1 });
  const encoded = `scrypt-v1$${salt.toString("base64")}$${hash.toString("base64")}`;
  db.prepare("INSERT INTO users VALUES(?,?,?,?,1,1,1)").run(
    "owner",
    "Owner",
    "owner",
    encoded,
  );
  try {
    assert.equal(await verifyPassword("wrong-password", encoded), false);
    const user = await authenticateUser(db, "owner", "legacy-password");
    assert.ok(user);
    const upgraded = db
      .prepare("SELECT password_hash AS hash FROM users")
      .get()!.hash as string;
    assert.match(upgraded, /^scrypt-v2\$/);
    assert.equal(await verifyPassword("legacy-password", upgraded), true);
    assert.ok(createSessionRecord(user, db).token);
  } finally {
    db.close();
  }
});

test("SQLite page ceiling protects writes outside the transaction wrapper", async () => {
  const { applyDatabasePageLimit } =
    await import("../server/security/storage-budget.ts");
  const { apiError } = await import("../server/http/http.ts");
  const previous = process.env.DM_COMMAND_TABLE_DATABASE_LIMIT_MB;
  process.env.DM_COMMAND_TABLE_DATABASE_LIMIT_MB = "1";
  const db = new DatabaseSync(":memory:");
  db.exec("CREATE TABLE content(value BLOB)");
  try {
    applyDatabasePageLimit(db);
    try {
      db.exec("INSERT INTO content VALUES(zeroblob(2000000))");
      assert.fail("Expected SQLite budget rejection");
    } catch (error) {
      assert.equal(apiError(error).status, 413);
    }
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM content").get()!.n, 0);
  } finally {
    db.close();
    if (previous === undefined)
      delete process.env.DM_COMMAND_TABLE_DATABASE_LIMIT_MB;
    else process.env.DM_COMMAND_TABLE_DATABASE_LIMIT_MB = previous;
  }
});

test("legacy login upgrade cannot overwrite a concurrent credential reset", async () => {
  const { hashPassword } = await import("../server/security/passwords.ts");
  const db = new DatabaseSync(":memory:");
  runMigrations(db);
  const salt = Buffer.alloc(16, 4),
    hash = scryptSync("legacy-password", salt, 64, { N: 16384, r: 8, p: 1 });
  const legacy = `scrypt-v1$${salt.toString("base64")}$${hash.toString("base64")}`;
  db.prepare("INSERT INTO users VALUES(?,?,?,?,1,1,1)").run(
    "owner",
    "Owner",
    "owner",
    legacy,
  );
  try {
    const replacement = await hashPassword("replacement-password");
    const pending = authenticateUser(db, "owner", "legacy-password");
    db.prepare("UPDATE users SET password_hash=? WHERE id=?").run(
      replacement,
      "owner",
    );
    assert.equal(await pending, null);
    assert.equal(
      db.prepare("SELECT password_hash AS hash FROM users").get()!.hash,
      replacement,
    );
  } finally {
    db.close();
  }
});
