import type { DatabaseSync } from "node:sqlite";
import {
  hashPassword,
  normaliseUsername,
  validateCredentials,
  verifyPassword,
} from "../security/passwords.ts";
import { createV6ManagedUserRecord } from "./auth.ts";
import { PublicApiError } from "./errors.ts";
import { runTransaction } from "../../db/transaction.ts";

export type ManagedV6User = {
  id: string;
  username: string;
  displayName: string;
  isAdmin: boolean;
  createdAt: string;
};
type UserRow = Omit<ManagedV6User, "isAdmin" | "createdAt"> & {
  isAdmin: number;
  createdAt: number;
};

export function listV6Users(database: DatabaseSync): ManagedV6User[] {
  return (
    database
      .prepare(
        "SELECT id, username, display_name AS displayName, is_admin AS isAdmin, created_at AS createdAt FROM users ORDER BY username COLLATE NOCASE",
      )
      .all() as UserRow[]
  ).map((row) => ({
    ...row,
    isAdmin: Boolean(row.isAdmin),
    createdAt: new Date(row.createdAt).toISOString(),
  }));
}
export function renameV6Account(
  database: DatabaseSync,
  userId: string,
  usernameValue: string,
  displayName?: string,
) {
  const username = normaliseUsername(usernameValue);
  const validation = validateCredentials(username, "temporary-password");
  if (validation) throw new PublicApiError(validation);
  if (
    database
      .prepare(
        "SELECT id FROM users WHERE username = ? COLLATE NOCASE AND id <> ?",
      )
      .get(username, userId)
  )
    throw new PublicApiError("That username is already registered.", 409);
  const result = database
    .prepare(
      "UPDATE users SET username = ?, display_name = COALESCE(?, display_name), updated_at = ? WHERE id = ?",
    )
    .run(
      username,
      displayName?.trim().slice(0, 80) || null,
      Date.now(),
      userId,
    );
  if (!result.changes) throw new PublicApiError("Account not found.", 404);
}
export async function changeV6Password(
  database: DatabaseSync,
  userId: string,
  currentPassword: string,
  newPassword: string,
) {
  if (newPassword.length < 8 || newPassword.length > 128)
    throw new PublicApiError("Password must be between 8 and 128 characters.");
  const row = database
    .prepare("SELECT password_hash AS passwordHash FROM users WHERE id = ?")
    .get(userId) as { passwordHash: string } | undefined;
  if (!row || !(await verifyPassword(currentPassword, row.passwordHash)))
    throw new PublicApiError("The current password is incorrect.");
  const passwordHash = await hashPassword(newPassword);
  runTransaction(database, () => {
    database
      .prepare(
        "UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?",
      )
      .run(passwordHash, Date.now(), userId);
    database
      .prepare("DELETE FROM local_sessions WHERE user_id = ?")
      .run(userId);
  });
}
export async function createV6ManagedUser(
  database: DatabaseSync,
  input: { username: string; displayName: string; password: string },
) {
  return createV6ManagedUserRecord(database, input);
}
export async function updateV6ManagedUser(
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
    if (!database.prepare("SELECT 1 FROM users WHERE id = ?").get(id))
      throw new PublicApiError("User not found.", 404);
    if (input.username)
      renameV6Account(database, id, input.username, input.displayName);
    else if (input.displayName !== undefined)
      database
        .prepare(
          "UPDATE users SET display_name = ?, updated_at = ? WHERE id = ?",
        )
        .run(input.displayName.trim().slice(0, 80), Date.now(), id);
    if (passwordHash !== undefined) {
      database
        .prepare(
          "UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?",
        )
        .run(passwordHash, Date.now(), id);
      database.prepare("DELETE FROM local_sessions WHERE user_id = ?").run(id);
    }
    if (input.isAdmin !== undefined) {
      if (id === actorId && !input.isAdmin)
        throw new PublicApiError(
          "You cannot remove your own administrator access.",
        );
      const count = database
        .prepare("SELECT COUNT(*) AS count FROM users WHERE is_admin = 1")
        .get() as { count: number };
      if (!input.isAdmin && count.count <= 1)
        throw new PublicApiError("At least one administrator is required.");
      database
        .prepare("UPDATE users SET is_admin = ?, updated_at = ? WHERE id = ?")
        .run(input.isAdmin ? 1 : 0, Date.now(), id);
    }
  });
}
export function deleteV6ManagedUser(
  database: DatabaseSync,
  id: string,
  actorId: string,
) {
  if (id === actorId)
    throw new PublicApiError("You cannot delete your own account.");
  const result = database.prepare("DELETE FROM users WHERE id = ?").run(id);
  if (!result.changes) throw new PublicApiError("User not found.", 404);
}
