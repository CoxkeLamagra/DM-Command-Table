import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { runMigrations } from "../db/migrations.ts";
import {
  createV6ManagedUser,
  deleteV6ManagedUser,
  listV6Users,
  renameV6Account,
  updateV6ManagedUser,
} from "../server/v6/accounts.ts";
import { registerV6User, registrationStatus } from "../server/v6/auth.ts";

test("v6 administrators manage local accounts without removing the final admin", async () => {
  const database = new DatabaseSync(":memory:");
  database.exec("PRAGMA foreign_keys = ON");
  runMigrations(database);
  const owner = await registerV6User(database, {
    username: "owner",
    displayName: "Owner",
    password: "password-one",
  });
  assert.equal(registrationStatus(database).registrationEnabled, false);
  const member = await createV6ManagedUser(database, {
    username: "member",
    displayName: "Member",
    password: "password-two",
  });
  assert.equal(registrationStatus(database).registrationEnabled, false);
  renameV6Account(database, member.userId, "renamed", "Renamed Member");
  await updateV6ManagedUser(
    database,
    member.userId,
    { isAdmin: true },
    owner.userId,
  );
  assert.equal(
    listV6Users(database).find(({ id }) => id === member.userId)?.isAdmin,
    true,
  );
  await updateV6ManagedUser(
    database,
    member.userId,
    { isAdmin: false },
    owner.userId,
  );
  await assert.rejects(
    () =>
      updateV6ManagedUser(
        database,
        "missing",
        { displayName: "Nobody" },
        owner.userId,
      ),
    /not found/i,
  );
  await assert.rejects(() =>
    updateV6ManagedUser(
      database,
      owner.userId,
      { isAdmin: false },
      owner.userId,
    ),
  );
  deleteV6ManagedUser(database, member.userId, owner.userId);
  assert.equal(listV6Users(database).length, 1);
  database.close();
});
