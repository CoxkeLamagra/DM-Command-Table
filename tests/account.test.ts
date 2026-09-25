import assert from "node:assert/strict";
import { unlink } from "node:fs/promises";
import test from "node:test";

test("accounts can rename uniquely and change their own password", async () => {
  const databasePath = `/tmp/dm-command-table-account-${process.pid}.sqlite`;
  process.env.DM_COMMAND_TABLE_DB_PATH = databasePath;
  const { registerLocalUser } = await import("../server/auth/registration.ts");
  const { changeOwnPassword, renameAccount } = await import(
    "../server/auth/account.ts"
  );
  const { findLocalUser, verifyPassword } = await import(
    "../server/auth/credentials.ts"
  );
  const { getDatabase } = await import("../db/sqlite.ts");

  const first = registerLocalUser({
    username: "first_account",
    displayName: "First Account",
    password: "password-one",
  });
  const second = registerLocalUser({
    username: "second_account",
    displayName: "Second Account",
    password: "password-two",
  });
  assert.ok("user" in first && "user" in second);
  if ("user" in first && "user" in second) {
    assert.equal(
      renameAccount(first.user.userId, second.user.username),
      "duplicate",
    );
    assert.equal(renameAccount(first.user.userId, "renamed_account"), "updated");
    assert.equal(findLocalUser("first_account"), null);
    assert.equal(findLocalUser("renamed_account")?.displayName, "First Account");

    getDatabase()
      .prepare(
        "INSERT INTO local_sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)",
      )
      .run("account-token", first.user.userId, Date.now() + 10000, Date.now());
    assert.equal(
      changeOwnPassword(first.user.userId, "wrong-password", "replacement-password"),
      "invalid_password",
    );
    assert.equal(
      changeOwnPassword(first.user.userId, "password-one", "replacement-password"),
      "updated",
    );
    const renamed = findLocalUser("renamed_account");
    assert.ok(renamed && verifyPassword("replacement-password", renamed.passwordHash));
    assert.equal(
      (
        getDatabase()
          .prepare("SELECT COUNT(*) AS count FROM local_sessions WHERE user_id = ?")
          .get(first.user.userId) as { count: number }
      ).count,
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
