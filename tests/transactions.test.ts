import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { runTransaction } from "../db/transaction.ts";
test("nested transactions preserve rollback on Node runtimes without isTransaction", () => {
  const database = new DatabaseSync(":memory:");
  const trackedDatabase = {
    exec: database.exec.bind(database),
    prepare: database.prepare.bind(database),
  } as DatabaseSync;
  database.exec("CREATE TABLE changes(value TEXT)");
  runTransaction(trackedDatabase, () => {
    database.prepare("INSERT INTO changes VALUES(?)").run("outer");
    assert.throws(() =>
      runTransaction(trackedDatabase, () => {
        database.prepare("INSERT INTO changes VALUES(?)").run("inner");
        throw new Error("rollback inner");
      }),
    );
    runTransaction(trackedDatabase, () =>
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

test("non-growing transactions avoid filesystem metadata queries", () => {
  const db = new DatabaseSync(":memory:");
  db.exec(
    "CREATE TABLE values_test(value INTEGER); INSERT INTO values_test VALUES(1)",
  );
  const queries: string[] = [];
  const wrapper = {
    exec: db.exec.bind(db),
    prepare: (sql: string) => {
      queries.push(sql);
      return db.prepare(sql);
    },
  } as unknown as DatabaseSync;
  try {
    runTransaction(wrapper, () => db.exec("UPDATE values_test SET value=2"));
    assert.equal(db.prepare("SELECT value FROM values_test").get()!.value, 2);
    assert.ok(!queries.includes("PRAGMA database_list"));
  } finally {
    db.close();
  }
});
