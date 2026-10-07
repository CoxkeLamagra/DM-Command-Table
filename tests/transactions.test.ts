import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { runTransaction } from "../db/transaction.ts";
test("nested transactions preserve rollback on Node runtimes without isTransaction", () => {
  const database = new DatabaseSync(":memory:");
  const legacyDatabase = {
    exec: database.exec.bind(database),
  } as DatabaseSync;
  database.exec("CREATE TABLE changes(value TEXT)");
  runTransaction(legacyDatabase, () => {
    database.prepare("INSERT INTO changes VALUES(?)").run("outer");
    assert.throws(() =>
      runTransaction(legacyDatabase, () => {
        database.prepare("INSERT INTO changes VALUES(?)").run("inner");
        throw new Error("rollback inner");
      }),
    );
    runTransaction(legacyDatabase, () =>
      database.prepare("INSERT INTO changes VALUES(?)").run("nested"),
    );
  });
  assert.deepEqual(
    database
      .prepare("SELECT value FROM changes")
      .all()
      .map(({ value }) => value),
    ["outer", "nested"],
  );
  database.close();
});
