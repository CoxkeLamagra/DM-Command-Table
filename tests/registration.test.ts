import assert from "node:assert/strict";
import { unlink } from "node:fs/promises";
import test from "node:test";

test("first registration becomes admin and later registrations remain users", async () => {
  const databasePath = `/tmp/dm-command-table-registration-${process.pid}.sqlite`;
  process.env.DM_COMMAND_TABLE_DB_PATH = databasePath;
  const { registerLocalUser } = await import("../server/auth/registration.ts");
  const { getDatabase } = await import("../db/sqlite.ts");
  const {
    countAdmins,
    deleteUser,
    resetUserPassword,
    setUserAdmin,
    updateUser,
  } = await import("../server/admin/users.ts");

  const first = registerLocalUser({
    username: "first_admin",
    displayName: "First Admin",
    password: "password-one",
  });
  const second = registerLocalUser({
    username: "second_user",
    displayName: "Second User",
    password: "password-two",
  });

  assert.ok("user" in first && first.user.isAdmin);
  assert.ok("user" in second && !second.user.isAdmin);
  const campaigns = getDatabase()
    .prepare("SELECT owner_id AS ownerId FROM campaigns ORDER BY created_at")
    .all() as Array<{ ownerId: string }>;
  assert.equal(campaigns.length, 2);
  if ("user" in first && "user" in second) {
    assert.deepEqual(
      campaigns.map((campaign) => campaign.ownerId).sort(),
      [first.user.userId, second.user.userId].sort(),
    );
    assert.equal(updateUser(second.user.userId, "renamed_user", "Renamed User"), "updated");
    getDatabase()
      .prepare(
        "INSERT INTO local_sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)",
      )
      .run("token", second.user.userId, Date.now() + 10000, Date.now());
    assert.equal(resetUserPassword(second.user.userId, "replacement-password"), true);
    assert.equal(
      (getDatabase().prepare("SELECT COUNT(*) AS count FROM local_sessions WHERE user_id = ?").get(second.user.userId) as { count: number }).count,
      0,
    );
    assert.equal(setUserAdmin(second.user.userId, true), true);
    assert.equal(countAdmins(), 2);
    assert.equal(deleteUser(second.user.userId), true);
    assert.equal(
      (getDatabase().prepare("SELECT COUNT(*) AS count FROM campaigns WHERE owner_id = ?").get(second.user.userId) as { count: number }).count,
      0,
    );
  }

  getDatabase().close();
  await Promise.all([
    unlink(databasePath).catch(() => undefined),
    unlink(`${databasePath}-wal`).catch(() => undefined),
    unlink(`${databasePath}-shm`).catch(() => undefined),
  ]);
});
