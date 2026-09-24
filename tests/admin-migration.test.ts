import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { applyRuntimeMigrations, RUNTIME_SCHEMA } from "../db/runtime-schema.ts";

test("existing local installations promote the earliest account to administrator", () => {
  const database = new DatabaseSync(":memory:");
  database.exec(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY NOT NULL,
      email TEXT NOT NULL,
      display_name TEXT NOT NULL,
      username TEXT,
      password_hash TEXT,
      updated_at INTEGER NOT NULL
    );
    INSERT INTO users VALUES
      ('second', 'second@local', 'Second', 'second', 'hash', 200),
      ('first', 'first@local', 'First', 'first', 'hash', 100);
  `);

  applyRuntimeMigrations(database);
  applyRuntimeMigrations(database);

  const users = database
    .prepare("SELECT id, is_admin AS isAdmin FROM users ORDER BY id")
    .all() as Array<{ id: string; isAdmin: number }>;
  assert.deepEqual(users.map((user) => ({ ...user })), [
    { id: "first", isAdmin: 1 },
    { id: "second", isAdmin: 0 },
  ]);
  database.close();
});

test("runtime schema includes persistent screenshot metadata", () => {
  const database = new DatabaseSync(":memory:");
  database.exec(RUNTIME_SCHEMA);
  const columns = database.prepare("PRAGMA table_info(screenshots)").all() as Array<{
    name: string;
  }>;
  assert.deepEqual(
    columns.map((column) => column.name),
    ["id", "filename", "original_name", "mime_type", "size", "uploaded_by", "created_at"],
  );
  database.close();
});
