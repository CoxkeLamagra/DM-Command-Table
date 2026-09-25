import { getDatabase } from "../../db/sqlite.ts";
import { runTransaction } from "../../db/transaction.ts";
import {
  hashPassword,
  normaliseUsername,
  verifyPassword,
} from "./credentials.ts";

export function renameAccount(
  userId: string,
  usernameValue: string,
): "updated" | "not_found" | "duplicate" {
  const username = normaliseUsername(usernameValue);
  const db = getDatabase();
  const existing = db
    .prepare("SELECT id FROM users WHERE id = ? AND password_hash IS NOT NULL")
    .get(userId);
  if (!existing) return "not_found";
  const duplicate = db
    .prepare("SELECT id FROM users WHERE username = ? AND id <> ? LIMIT 1")
    .get(username, userId);
  if (duplicate) return "duplicate";

  return runTransaction(db, () => {
    db.prepare(
      `DELETE FROM campaign_members
       WHERE user_id = ? AND EXISTS (
         SELECT 1 FROM campaign_members pending
         WHERE pending.campaign_id = campaign_members.campaign_id
           AND pending.invite_email = ?
           AND pending.user_id IS NULL
       )`,
    ).run(userId, username);
    db.prepare(
      "UPDATE campaign_members SET invite_email = ? WHERE user_id = ?",
    ).run(username, userId);
    db.prepare(
      "UPDATE campaign_members SET user_id = ? WHERE user_id IS NULL AND invite_email = ?",
    ).run(userId, username);
    db.prepare(
      "UPDATE users SET username = ?, updated_at = ? WHERE id = ?",
    ).run(username, Date.now(), userId);
    return "updated";
  });
}

export function changeOwnPassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
): "updated" | "not_found" | "invalid_password" {
  const db = getDatabase();
  const existing = db
    .prepare(
      "SELECT password_hash AS passwordHash FROM users WHERE id = ? AND password_hash IS NOT NULL",
    )
    .get(userId) as { passwordHash: string } | undefined;
  if (!existing) return "not_found";
  if (!verifyPassword(currentPassword, existing.passwordHash))
    return "invalid_password";

  return runTransaction(db, () => {
    db.prepare(
      "UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?",
    ).run(hashPassword(newPassword), Date.now(), userId);
    db.prepare("DELETE FROM local_sessions WHERE user_id = ?").run(userId);
    return "updated";
  });
}
