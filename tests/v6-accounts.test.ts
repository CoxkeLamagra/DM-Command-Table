import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { runMigrations } from "../db/migrations.ts";
import { createV6ManagedUser, deleteV6ManagedUser, listV6Users, renameV6Account, updateV6ManagedUser } from "../server/v6/accounts.ts";
import { registerV6User } from "../server/v6/auth.ts";

test("v6 administrators manage local accounts without removing the final admin", () => {
  const database = new DatabaseSync(":memory:");
  database.exec("PRAGMA foreign_keys = ON");
  runMigrations(database);
  const owner = registerV6User(database, { username: "owner", displayName: "Owner", password: "password-one" });
  const member = createV6ManagedUser(database, { username: "member", displayName: "Member", password: "password-two" });
  renameV6Account(database, member.userId, "renamed", "Renamed Member");
  updateV6ManagedUser(database, member.userId, { isAdmin: true }, owner.userId);
  assert.equal(listV6Users(database).find(({ id }) => id === member.userId)?.isAdmin, true);
  updateV6ManagedUser(database, member.userId, { isAdmin: false }, owner.userId);
  assert.throws(() => updateV6ManagedUser(database, owner.userId, { isAdmin: false }, owner.userId));
  deleteV6ManagedUser(database, member.userId, owner.userId);
  assert.equal(listV6Users(database).length, 1);
  database.close();
});
