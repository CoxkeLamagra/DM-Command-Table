import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { RUNTIME_SCHEMA } from "../db/runtime-schema.ts";

test("runtime schema creates the canonical local account model", () => {
  const database = new DatabaseSync(":memory:");
  database.exec(RUNTIME_SCHEMA);
  const columns = database.prepare("PRAGMA table_info(users)").all() as Array<{
    name: string;
    notnull: number;
  }>;
  assert.deepEqual(
    columns.map((column) => column.name),
    ["id", "display_name", "username", "password_hash", "is_admin", "updated_at"],
  );
  assert.equal(columns.find((column) => column.name === "username")?.notnull, 1);
  assert.equal(columns.find((column) => column.name === "password_hash")?.notnull, 1);
  database.close();
});

test("runtime schema includes persistent screenshot metadata", () => {
  const database = new DatabaseSync(":memory:");
  database.exec(RUNTIME_SCHEMA);
  const columns = database.prepare("PRAGMA table_info(screenshots)").all() as Array<{ name: string }>;
  assert.deepEqual(
    columns.map((column) => column.name),
    ["id", "filename", "original_name", "mime_type", "size", "uploaded_by", "created_at"],
  );
  database.close();
});
