import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { migrations, runMigrations } from "../db/migrations.ts";

test("current migrations create the normalized local-only schema", () => {
  const database = new DatabaseSync(":memory:");
  database.exec("PRAGMA foreign_keys = ON");

  runMigrations(database);
  runMigrations(database);

  const applied = database
    .prepare("SELECT version, name FROM schema_migrations ORDER BY version")
    .all() as Array<{ version: number; name: string }>;
  assert.deepEqual(
    applied.map(({ version, name }) => ({ version, name })),
    migrations.map(({ version, name }) => ({ version, name })),
  );

  const tables = new Set(
    (
      database
        .prepare(
          "SELECT name FROM sqlite_master WHERE type IN ('table', 'view')",
        )
        .all() as Array<{ name: string }>
    ).map(({ name }) => name),
  );
  for (const table of [
    "campaigns",
    "players",
    "monsters",
    "sessions",
    "story_beats",
    "story_session_links",
    "prepared_encounters",
    "combat_encounters",
    "combatants",
    "combat_conditions",
    "combat_history",
    "screenshots",
    "screenshot_references",
    "session_templates",
    "audit_events",
    "search_index",
  ]) {
    assert.equal(tables.has(table), true, `missing ${table}`);
  }

  const duplicatePlayer = database
    .prepare(
      "SELECT sql FROM sqlite_master WHERE type = 'index' AND name = 'idx_unique_combat_player'",
    )
    .get() as { sql: string };
  assert.match(duplicatePlayer.sql, /WHERE player_id IS NOT NULL/);
  const combatantColumns = database
    .prepare("PRAGMA table_info(combatants)")
    .all() as Array<{ name: string }>;
  assert.equal(
    combatantColumns.some(({ name }) => name === "notes"),
    true,
  );
  database.close();
});

test("a failed migration is rolled back without recording its version", () => {
  const database = new DatabaseSync(":memory:");
  database.exec("CREATE TABLE users (id TEXT PRIMARY KEY)");

  assert.throws(() => runMigrations(database));
  const applied = database
    .prepare("SELECT COUNT(*) AS count FROM schema_migrations")
    .get() as { count: number };
  assert.equal(applied.count, 0);
  database.close();
});

test("earlier database baselines are rejected without changing their data", () => {
  const database = new DatabaseSync(":memory:");
  database.exec(
    "CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY, name TEXT, applied_at INTEGER); INSERT INTO schema_migrations VALUES(1, 'local-first-baseline', 1); CREATE TABLE sentinel(value TEXT); INSERT INTO sentinel VALUES('preserved');",
  );
  assert.throws(() => runMigrations(database), /fresh data directory/);
  assert.equal(
    database.prepare("SELECT value FROM sentinel").get()!.value,
    "preserved",
  );
  assert.equal(
    database
      .prepare(
        "SELECT count(*) AS n FROM sqlite_master WHERE name='combatants'",
      )
      .get()!.n,
    0,
  );
  database.close();
});

test("v11 token migration separates existing token images without touching actions", () => {
  const database = new DatabaseSync(":memory:");
  try {
    database.exec(migrations[0].sql);
    database.exec(
      "CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY,name TEXT,applied_at INTEGER); INSERT INTO schema_migrations VALUES(1,'offline-runtime-baseline',1); INSERT INTO users VALUES('owner','Owner','owner','hash',1,1,1); INSERT INTO campaigns(id,owner_id,name,created_at,updated_at) VALUES('campaign','owner','Campaign',1,1);",
    );
    const token =
      '<img src="/api/screenshots/abcdef-1234" alt="Monster token" />';
    database
      .prepare(
        "INSERT INTO monsters(id,campaign_id,name,type,challenge_rating,armor_class,hit_points,speed,stats,abilities,spells,notes,spell_slots,created_at,updated_at) VALUES('monster','campaign','Cat','','',12,2,'','',?,'','','[]',1,1)",
      )
      .run(token + "\nActions\nClaw");
    runMigrations(database);
    runMigrations(database);
    const monster = database
      .prepare(
        "SELECT json_extract(payload,'$.token') AS token,json_extract(payload,'$.abilities') AS abilities FROM monster_definitions",
      )
      .get();
    assert.deepEqual({ ...monster }, { token, abilities: "Actions\nClaw" });
  } finally {
    database.close();
  }
});
