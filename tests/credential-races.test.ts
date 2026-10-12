import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { runMigrations } from "../db/migrations.ts";
import {
  authenticateUser,
  createSessionRecord,
  registerUser,
} from "../server/identity/auth.ts";
import {
  changePassword,
  createManagedUser,
  updateManagedUser,
} from "../server/identity/accounts.ts";
import { hashPassword, verifyPassword } from "../server/security/passwords.ts";
function fixture() {
  const db = new DatabaseSync(":memory:");
  runMigrations(db);
  return db;
}
test("a concurrent password reset invalidates login verification and pending session grants", async () => {
  const db = fixture();
  try {
    const user = await registerUser(db, {
      username: "owner",
      displayName: "Owner",
      password: "old-password",
    });
    const pending = authenticateUser(db, "owner", "old-password");
    db.prepare(
      "UPDATE users SET password_hash='reset-by-admin' WHERE id=?",
    ).run(user.userId);
    assert.equal(await pending, null);
    assert.throws(() => createSessionRecord(user, db), /Credentials changed/);
    assert.equal(
      (
        db.prepare("SELECT COUNT(*) AS n FROM local_sessions").get() as {
          n: number;
        }
      ).n,
      0,
    );
    assert.ok(!JSON.stringify(user).includes("scrypt"));
  } finally {
    db.close();
  }
});
test("password changes cannot overwrite a concurrent reset; successful changes revoke old sessions", async () => {
  const db = fixture();
  try {
    const user = await registerUser(db, {
      username: "owner",
      displayName: "Owner",
      password: "old-password",
    });
    createSessionRecord(user, db);
    const pending = changePassword(
      db,
      user.userId,
      "old-password",
      "new-password",
    );
    db.prepare(
      "UPDATE users SET password_hash='reset-by-admin' WHERE id=?",
    ).run(user.userId);
    await assert.rejects(pending, /Credentials changed/);
    assert.equal(
      (
        db
          .prepare("SELECT password_hash AS hash FROM users WHERE id=?")
          .get(user.userId) as { hash: string }
      ).hash,
      "reset-by-admin",
    );
    db.prepare("UPDATE users SET password_hash=? WHERE id=?").run(
      await hashPassword("old-password"),
      user.userId,
    );
    const current = await authenticateUser(db, "owner", "old-password");
    assert.ok(current);
    const authenticated = await changePassword(
      db,
      user.userId,
      "old-password",
      "new-password",
    );
    assert.throws(
      () => createSessionRecord(current, db),
      /Credentials changed/,
    );
    const session = createSessionRecord(authenticated, db);
    assert.equal(session.token.length, 43);
    assert.equal(
      (
        db.prepare("SELECT COUNT(*) AS n FROM local_sessions").get() as {
          n: number;
        }
      ).n,
      1,
    );
  } finally {
    db.close();
  }
});
test("revoked administrators cannot finish asynchronous account creates or password resets", async () => {
  const db = fixture();
  try {
    const admin = await registerUser(db, {
      username: "owner",
      displayName: "Owner",
      password: "password-one",
    });
    const create = createManagedUser(
      db,
      { username: "member", displayName: "Member", password: "password-two" },
      admin.userId,
    );
    db.prepare("UPDATE users SET is_admin=0 WHERE id=?").run(admin.userId);
    await assert.rejects(create, /Administrator access/);
    assert.equal(
      (db.prepare("SELECT COUNT(*) AS n FROM users").get() as { n: number }).n,
      1,
    );
    db.prepare("UPDATE users SET is_admin=1 WHERE id=?").run(admin.userId);
    const reset = updateManagedUser(
      db,
      admin.userId,
      { password: "another-password" },
      admin.userId,
    );
    db.prepare("UPDATE users SET is_admin=0 WHERE id=?").run(admin.userId);
    await assert.rejects(reset, /Administrator access/);
    assert.ok(await authenticateUser(db, "owner", "password-one"));
  } finally {
    db.close();
  }
});
test("password work rejects excess concurrency and releases capacity after completion", async () => {
  const results = await Promise.allSettled(
    Array.from({ length: 5 }, () => hashPassword("password-one")),
  );
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 4);
  const failure = results.find(
    (r) => r.status === "rejected",
  ) as PromiseRejectedResult;
  assert.equal(failure.reason.status, 503);
  const hash = await hashPassword("password-two");
  assert.ok(await verifyPassword("password-two", hash));
});
