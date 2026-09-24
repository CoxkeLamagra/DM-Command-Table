import { getDatabase } from "@/db/sqlite";
import { hashPassword, normaliseUsername } from "@/server/auth/credentials";

export type AdminUser = {
  id: string;
  username: string;
  displayName: string;
  isAdmin: boolean;
  updatedAt: string;
};

type AdminUserRow = Omit<AdminUser, "isAdmin" | "updatedAt"> & {
  isAdmin: number;
  updatedAt: number;
};

export function listUsers(): AdminUser[] {
  const rows = getDatabase()
    .prepare(
      `SELECT id, username, display_name AS displayName, is_admin AS isAdmin,
              updated_at AS updatedAt
       FROM users
       WHERE username IS NOT NULL AND password_hash IS NOT NULL
       ORDER BY is_admin DESC, username ASC`,
    )
    .all() as AdminUserRow[];
  return rows.map((row) => ({
    ...row,
    isAdmin: Boolean(row.isAdmin),
    updatedAt: new Date(row.updatedAt).toISOString(),
  }));
}

export function updateUser(
  id: string,
  usernameValue: string,
  displayNameValue: string,
): "updated" | "not_found" | "duplicate" {
  const username = normaliseUsername(usernameValue);
  const displayName = displayNameValue.trim().slice(0, 80) || username;
  const db = getDatabase();
  const existing = db
    .prepare("SELECT username FROM users WHERE id = ? AND password_hash IS NOT NULL")
    .get(id) as { username: string } | undefined;
  if (!existing) return "not_found";
  const duplicate = db
    .prepare("SELECT id FROM users WHERE username = ? AND id <> ? LIMIT 1")
    .get(username, id);
  if (duplicate) return "duplicate";

  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare(
      `DELETE FROM campaign_members
       WHERE user_id = ? AND EXISTS (
         SELECT 1 FROM campaign_members pending
         WHERE pending.campaign_id = campaign_members.campaign_id
           AND pending.invite_email = ?
           AND pending.user_id IS NULL
       )`,
    ).run(id, username);
    db.prepare(
      "UPDATE campaign_members SET invite_email = ? WHERE user_id = ?",
    ).run(username, id);
    db.prepare(
      "UPDATE campaign_members SET user_id = ? WHERE user_id IS NULL AND invite_email = ?",
    ).run(id, username);
    db.prepare(
      "UPDATE users SET username = ?, display_name = ?, updated_at = ? WHERE id = ?",
    ).run(username, displayName, Date.now(), id);
    db.exec("COMMIT");
    return "updated";
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function resetUserPassword(id: string, password: string): boolean {
  const result = getDatabase()
    .prepare(
      "UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ? AND password_hash IS NOT NULL",
    )
    .run(hashPassword(password), Date.now(), id);
  if (result.changes) {
    getDatabase().prepare("DELETE FROM local_sessions WHERE user_id = ?").run(id);
  }
  return result.changes > 0;
}

export function setUserAdmin(id: string, isAdmin: boolean): boolean {
  const result = getDatabase()
    .prepare(
      "UPDATE users SET is_admin = ?, updated_at = ? WHERE id = ? AND password_hash IS NOT NULL",
    )
    .run(isAdmin ? 1 : 0, Date.now(), id);
  return result.changes > 0;
}

export function deleteUser(id: string): boolean {
  const db = getDatabase();
  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare("DELETE FROM local_sessions WHERE user_id = ?").run(id);
    db.prepare("DELETE FROM campaign_members WHERE user_id = ?").run(id);
    db.prepare(
      "DELETE FROM campaign_members WHERE campaign_id IN (SELECT id FROM campaigns WHERE owner_id = ?)",
    ).run(id);
    db.prepare("DELETE FROM campaigns WHERE owner_id = ?").run(id);
    const result = db
      .prepare("DELETE FROM users WHERE id = ? AND password_hash IS NOT NULL")
      .run(id);
    db.exec("COMMIT");
    return result.changes > 0;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function countAdmins(): number {
  const row = getDatabase()
    .prepare(
      "SELECT COUNT(*) AS count FROM users WHERE is_admin = 1 AND password_hash IS NOT NULL",
    )
    .get() as { count: number };
  return row.count;
}
