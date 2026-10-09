import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { runMigrations } from "../db/migrations.ts";
import {
  createManagedUser,
  deleteManagedUser,
  listUsers,
  renameAccount,
  updateManagedUser,
} from "../server/identity/accounts.ts";
import { registerUser, registrationStatus } from "../server/identity/auth.ts";

test("current administrators manage local accounts without removing the final admin", async () => {
  const database = new DatabaseSync(":memory:");
  database.exec("PRAGMA foreign_keys = ON");
  runMigrations(database);
  const owner = await registerUser(database, {
    username: "owner",
    displayName: "Owner",
    password: "password-one",
  });
  assert.equal(registrationStatus(database).registrationEnabled, false);
  const member = await createManagedUser(database, {
    username: "member",
    displayName: "Member",
    password: "password-two",
  });
  assert.equal(registrationStatus(database).registrationEnabled, false);
  renameAccount(database, member.userId, "renamed", "Renamed Member");
  await updateManagedUser(
    database,
    member.userId,
    { isAdmin: true },
    owner.userId,
  );
  assert.equal(
    listUsers(database).find(({ id }) => id === member.userId)?.isAdmin,
    true,
  );
  await updateManagedUser(
    database,
    member.userId,
    { isAdmin: false },
    owner.userId,
  );
  await assert.rejects(
    () =>
      updateManagedUser(
        database,
        "missing",
        { displayName: "Nobody" },
        owner.userId,
      ),
    /not found/i,
  );
  await assert.rejects(() =>
    updateManagedUser(database, owner.userId, { isAdmin: false }, owner.userId),
  );
  deleteManagedUser(database, member.userId, owner.userId);
  assert.equal(listUsers(database).length, 1);
  database.close();
});
