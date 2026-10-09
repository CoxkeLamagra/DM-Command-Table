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
