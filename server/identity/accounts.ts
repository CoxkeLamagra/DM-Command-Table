import { statement } from "../../db/statements.ts";
import type { DatabaseSync } from "node:sqlite";
import {
  hashPassword,
  normaliseUsername,
  validateCredentials,
  verifyPassword,
} from "../security/passwords.ts";
import { createManagedUserRecord, userForCredential } from "./auth.ts";
import { PublicApiError } from "../http/errors.ts";
import { runTransaction } from "../../db/transaction.ts";

export type ManagedUser = {
  id: string;
  username: string;
  displayName: string;
  isAdmin: boolean;
  createdAt: string;
};
type UserRow = Omit<ManagedUser, "isAdmin" | "createdAt"> & {
  isAdmin: number;
  createdAt: number;
};

export function listUsers(database: DatabaseSync): ManagedUser[] {
  return (
    statement(
      database,
      "SELECT id, username, display_name AS displayName, is_admin AS isAdmin, created_at AS createdAt FROM users ORDER BY username COLLATE NOCASE",
    ).all() as UserRow[]
  ).map((row) => ({
    ...row,
    isAdmin: Boolean(row.isAdmin),
    createdAt: new Date(row.createdAt).toISOString(),
  }));
}
export function renameAccount(
  database: DatabaseSync,
  userId: string,
  usernameValue: string,
  displayName?: string,
) {
  const username = normaliseUsername(usernameValue);
  const validation = validateCredentials(username, "temporary-password");
  if (validation) throw new PublicApiError(validation);
  if (
    statement(
      database,
      "SELECT id FROM users WHERE username = ? COLLATE NOCASE AND id <> ?",
    ).get(username, userId)
  )
    throw new PublicApiError("That username is already registered.", 409);
  const result = statement(
    database,
    "UPDATE users SET username = ?, display_name = COALESCE(?, display_name), updated_at = ? WHERE id = ?",
  ).run(username, displayName?.trim().slice(0, 80) || null, Date.now(), userId);
  if (!result.changes) throw new PublicApiError("Account not found.", 404);
}
export async function changePassword(
  database: DatabaseSync,
  userId: string,
  currentPassword: string,
  newPassword: string,
) {
  if (newPassword.length < 8 || newPassword.length > 128)
    throw new PublicApiError("Password must be between 8 and 128 characters.");
  const row = statement(
    database,
    "SELECT password_hash AS passwordHash FROM users WHERE id = ?",
  ).get(userId) as { passwordHash: string } | undefined;
  if (!row || !(await verifyPassword(currentPassword, row.passwordHash)))
    throw new PublicApiError("The current password is incorrect.");
  const passwordHash = await hashPassword(newPassword);
  return runTransaction(database, () => {
    const changed = statement(
      database,
      "UPDATE users SET password_hash=?,updated_at=? WHERE id=? AND password_hash=?",
    ).run(passwordHash, Date.now(), userId, row.passwordHash);
    if (!changed.changes)
      throw new PublicApiError(
        "Credentials changed. Please sign in again.",
        401,
      );
    statement(database, "DELETE FROM local_sessions WHERE user_id=?").run(
      userId,
    );
    return userForCredential(database, userId, passwordHash)!;
  });
}
export async function createManagedUser(
  database: DatabaseSync,
  input: { username: string; displayName: string; password: string },
  actorId: string,
) {
  requireAdministrator(database, actorId);
  return createManagedUserRecord(database, input, () =>
    requireAdministrator(database, actorId),
  );
}
export async function updateManagedUser(
  database: DatabaseSync,
  id: string,
  input: {
    username?: string;
    displayName?: string;
    password?: string;
    isAdmin?: boolean;
  },
  actorId: string,
) {
  if (
    input.password !== undefined &&
    (input.password.length < 8 || input.password.length > 128)
  )
    throw new PublicApiError("Password must be between 8 and 128 characters.");
  const passwordHash =
    input.password === undefined
      ? undefined
      : await hashPassword(input.password);
  runTransaction(database, () => {
    requireAdministrator(database, actorId);
    if (!statement(database, "SELECT 1 FROM users WHERE id = ?").get(id))
      throw new PublicApiError("User not found.", 404);
    if (input.username)
      renameAccount(database, id, input.username, input.displayName);
    else if (input.displayName !== undefined)
      statement(
        database,
        "UPDATE users SET display_name = ?, updated_at = ? WHERE id = ?",
      ).run(input.displayName.trim().slice(0, 80), Date.now(), id);
    if (passwordHash !== undefined) {
      statement(
        database,
        "UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?",
      ).run(passwordHash, Date.now(), id);
      statement(database, "DELETE FROM local_sessions WHERE user_id = ?").run(
        id,
      );
    }
    if (input.isAdmin !== undefined) {
      if (id === actorId && !input.isAdmin)
        throw new PublicApiError(
          "You cannot remove your own administrator access.",
        );
      const count = statement(
        database,
        "SELECT COUNT(*) AS count FROM users WHERE is_admin = 1",
      ).get() as { count: number };
      if (!input.isAdmin && count.count <= 1)
        throw new PublicApiError("At least one administrator is required.");
      statement(
        database,
        "UPDATE users SET is_admin = ?, updated_at = ? WHERE id = ?",
      ).run(input.isAdmin ? 1 : 0, Date.now(), id);
    }
  });
}
export function deleteManagedUser(
  database: DatabaseSync,
  id: string,
  actorId: string,
) {
  requireAdministrator(database, actorId);
  if (id === actorId)
    throw new PublicApiError("You cannot delete your own account.");
  const result = statement(database, "DELETE FROM users WHERE id = ?").run(id);
  if (!result.changes) throw new PublicApiError("User not found.", 404);
}

export function requireAdministrator(
  database: DatabaseSync,
  actorId: string,
): void {
  const row = statement(
    database,
    "SELECT is_admin AS isAdmin FROM users WHERE id=?",
  ).get(actorId) as { isAdmin: number } | undefined;
  if (!row?.isAdmin)
    throw new PublicApiError("Administrator access required.", 403);
}
