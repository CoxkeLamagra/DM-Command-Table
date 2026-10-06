import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { runMigrations } from "../db/migrations.ts";
import {
  authenticateV6User,
  registerV6User,
  registrationStatus,
  setRegistrationEnabled,
} from "../server/v6/auth.ts";

function database() {
  const value = new DatabaseSync(":memory:");
  value.exec("PRAGMA foreign_keys = ON");
  runMigrations(value);
  return value;
}

test("the first v6 account is admin and closes public registration", async () => {
  const db = database();
  assert.deepEqual(registrationStatus(db), {
    initialSetup: true,
    registrationEnabled: true,
  });
  const user = await registerV6User(db, {
    username: "DungeonMaster",
    displayName: "Dungeon Master",
    password: "correct-horse-battery-staple",
  });
  assert.equal(user.isAdmin, true);
  assert.equal(user.username, "dungeonmaster");
  assert.equal(registrationStatus(db).registrationEnabled, false);
  assert.equal(
    (
      await authenticateV6User(
        db,
        "DUNGEONMASTER",
        "correct-horse-battery-staple",
      )
    )?.userId,
    user.userId,
  );
  assert.equal(
    await authenticateV6User(db, user.username, "wrong-password"),
    null,
  );
  db.close();
});

test("administrators can reopen v6 registration", async () => {
  const db = database();
  await registerV6User(db, {
    username: "first-user",
    displayName: "First",
    password: "long-enough-password",
  });
  await assert.rejects(
    () =>
      registerV6User(db, {
        username: "second-user",
        displayName: "Second",
        password: "long-enough-password",
      }),
    /disabled/,
  );
  setRegistrationEnabled(db, true);
  const second = await registerV6User(db, {
    username: "second-user",
    displayName: "Second",
    password: "long-enough-password",
  });
  assert.equal(second.isAdmin, false);
  db.close();
});
