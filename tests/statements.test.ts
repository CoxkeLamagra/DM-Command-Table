import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { statement } from "../db/statements.ts";
test("prepared statement cache is connection-scoped, bounded and does not cache rows or permissions", () => {
  const db = new DatabaseSync(":memory:"),
    other = new DatabaseSync(":memory:");
  try {
    db.exec(
      "CREATE TABLE access(role TEXT);INSERT INTO access VALUES('viewer')",
    );
    const query = statement(db, "SELECT role FROM access");
    assert.equal(statement(db, "SELECT role FROM access"), query);
    assert.equal(query.get()!.role, "viewer");
    db.exec("UPDATE access SET role='editor'");
    assert.equal(query.get()!.role, "editor");
    assert.notEqual(statement(db, "SELECT 1"), statement(other, "SELECT 1"));
    for (let i = 0; i < 300; i++) statement(db, `SELECT ${i + 10}`);
    assert.notEqual(statement(db, "SELECT role FROM access"), query);
    assert.equal(
      statement(db, "SELECT role FROM access").get()!.role,
      "editor",
    );
  } finally {
    db.close();
    other.close();
  }
});
