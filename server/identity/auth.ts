import { statement } from "../../db/statements.ts";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { getDatabase } from "../../db/sqlite.ts";
import {
  hashPassword,
  normaliseUsername,
  validateCredentials,
  verifyPassword,
} from "../security/passwords.ts";
import { PublicApiError } from "../http/errors.ts";
import { getServerSettings } from "../administration/server-settings.ts";
import { runTransaction } from "../../db/transaction.ts";

const DUMMY_PASSWORD_HASH =
  "scrypt-v1$AAAAAAAAAAAAAAAAAAAAAA==$" + Buffer.alloc(64).toString("base64");

const sessionCredentials = new WeakMap<User, string>();

const sessionCleanup = new WeakMap<DatabaseSync, number>();

const COOKIE_NAME = "dmct_session";

import type { User } from "../../domain/types.ts";
export type { User } from "../../domain/types.ts";

type UserRow = Omit<User, "isAdmin"> & {
  isAdmin: number;
  passwordHash?: string;
};

export function registrationStatus(database = getDatabase()) {
  const count = statement(
    database,
    "SELECT COUNT(*) AS count FROM users",
  ).get() as { count: number };
  const setting = statement(
    database,
    "SELECT value FROM application_settings WHERE key = 'registration_enabled'",
  ).get() as { value: string } | undefined;
  return {
    initialSetup: count.count === 0,
    registrationEnabled: count.count === 0 || setting?.value === "true",
  };
}

export function setRegistrationEnabled(
  database: DatabaseSync,
  enabled: boolean,
): void {
  statement(
    database,
    `INSERT INTO application_settings (key, value, updated_at)
     VALUES ('registration_enabled', ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
  ).run(enabled ? "true" : "false", Date.now());
}

export async function registerUser(
  database: DatabaseSync,
  input: {
    username: string;
    displayName: string;
    password: string;
    bootstrapToken?: string;
  },
): Promise<User> {
  const username = normaliseUsername(input.username);
  const validation = validateCredentials(username, input.password);
  if (validation) throw new PublicApiError(validation);
  assertRegistrationAllowed(database, input.bootstrapToken);
  const passwordHash = await hashPassword(input.password);
  return runTransaction(database, () => {
    const status = registrationStatus(database);
    assertRegistrationAllowed(database, input.bootstrapToken);
    const user = createUserRecord(
      database,
      input,
      passwordHash,
      status.initialSetup,
    );
    if (status.initialSetup) setRegistrationEnabled(database, false);
    return user;
  });
}

export async function createManagedUserRecord(
  database: DatabaseSync,
  input: { username: string; displayName: string; password: string },
  authorize: () => void = () => undefined,
): Promise<User> {
  const username = normaliseUsername(input.username);
  const validation = validateCredentials(username, input.password);
  if (validation) throw new PublicApiError(validation);
  const passwordHash = await hashPassword(input.password);
  return runTransaction(database, () => {
    authorize();
    return createUserRecord(database, input, passwordHash, false);
  });
}

export async function authenticateUser(
  database: DatabaseSync,
  usernameValue: string,
  password: string,
): Promise<User | null> {
  const row = statement(
    database,
    `SELECT id AS userId, username, display_name AS displayName,
            is_admin AS isAdmin, password_hash AS passwordHash
       FROM users WHERE username = ? COLLATE NOCASE LIMIT 1`,
  ).get(normaliseUsername(usernameValue)) as UserRow | undefined;
  const valid = await verifyPassword(
    password,
    row?.passwordHash ?? DUMMY_PASSWORD_HASH,
  );
  if (!row?.passwordHash || !valid) return null;
  return userForCredential(database, row.userId, row.passwordHash);
}

export async function getUser(database = getDatabase()): Promise<User | null> {
  const { cookies } = await import("next/headers");
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const now = Date.now();
  if (now - (sessionCleanup.get(database) ?? 0) >= 60_000) {
    statement(database, "DELETE FROM local_sessions WHERE expires_at <= ?").run(
      now,
    );
    sessionCleanup.set(database, now);
  }
  const row = statement(
    database,
    `SELECT u.id AS userId, u.username, u.display_name AS displayName,
            u.is_admin AS isAdmin
       FROM local_sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = ? AND s.expires_at > ? LIMIT 1`,
  ).get(hashToken(token), now) as UserRow | undefined;
  return row ? toUser(row) : null;
}

// Credential evidence remains server-side and is rechecked immediately before issuing a session.
export function userForCredential(
  database: DatabaseSync,
  userId: string,
  passwordHash: string,
): User | null {
  const row = statement(
    database,
    "SELECT id AS userId,username,display_name AS displayName,is_admin AS isAdmin,password_hash AS passwordHash FROM users WHERE id=? AND password_hash=?",
  ).get(userId, passwordHash) as UserRow | undefined;
  if (!row) return null;
  const user = toUser(row);
  sessionCredentials.set(user, passwordHash);
  return user;
}
export function createSessionRecord(
  user: User,
  database: DatabaseSync,
  now = Date.now(),
) {
  return runTransaction(database, () => {
    const credential = sessionCredentials.get(user);
    if (
      !credential ||
      !statement(
        database,
        "SELECT 1 FROM users WHERE id=? AND password_hash=?",
      ).get(user.userId, credential)
    )
      throw new PublicApiError(
        "Credentials changed. Please sign in again.",
        401,
      );
    const token = randomBytes(32).toString("base64url"),
      sessionSeconds =
        getServerSettings(database).sessionLifetimeDays * 24 * 60 * 60;
    statement(
      database,
      "INSERT INTO local_sessions(token_hash,user_id,expires_at,created_at) VALUES(?,?,?,?)",
    ).run(hashToken(token), user.userId, now + sessionSeconds * 1000, now);
    return { token, sessionSeconds };
  });
}
export async function createSession(
  user: User,
  database = getDatabase(),
): Promise<void> {
  const { cookies } = await import("next/headers");
  const store = await cookies();
  const secure = await secureCookieEnabled(database);
  const { token, sessionSeconds } = createSessionRecord(user, database);
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: sessionSeconds,
  });
}

export async function destroySession(database = getDatabase()): Promise<void> {
  const { cookies } = await import("next/headers");
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (token)
    statement(database, "DELETE FROM local_sessions WHERE token_hash = ?").run(
      hashToken(token),
    );
  store.set(COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: await secureCookieEnabled(database),
    path: "/",
    maxAge: 0,
  });
}

function toUser(row: UserRow): User {
  return {
    userId: row.userId,
    username: row.username,
    displayName: row.displayName,
    isAdmin: Boolean(row.isAdmin),
  };
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function safeEqual(value: string, expected: string): boolean {
  const left = Buffer.from(value);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

function createUserRecord(
  database: DatabaseSync,
  input: { username: string; displayName: string; password: string },
  passwordHash: string,
  isAdmin: boolean,
): User {
  const username = normaliseUsername(input.username);
  if (
    statement(
      database,
      "SELECT id FROM users WHERE username = ? COLLATE NOCASE",
    ).get(username)
  )
    throw new PublicApiError("That username is already registered.", 409);
  const user: User = {
    userId: crypto.randomUUID(),
    username,
    displayName: input.displayName.trim().slice(0, 80) || username,
    isAdmin,
  };
  const now = Date.now();
  statement(
    database,
    `INSERT INTO users
      (id, display_name, username, password_hash, is_admin, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    user.userId,
    user.displayName,
    user.username,
    passwordHash,
    user.isAdmin ? 1 : 0,
    now,
    now,
  );
  sessionCredentials.set(user, passwordHash);
  return user;
}

function assertRegistrationAllowed(
  database: DatabaseSync,
  bootstrapToken?: string,
): void {
  const status = registrationStatus(database);
  if (!status.registrationEnabled)
    throw new PublicApiError("Account registration is disabled.", 403);
  if (status.initialSetup && process.env.NODE_ENV === "production") {
    const expected = process.env.DM_COMMAND_TABLE_BOOTSTRAP_TOKEN ?? "";
    if (!expected || !safeEqual(bootstrapToken ?? "", expected))
      throw new PublicApiError("The initial setup token is invalid.", 403);
  }
}

async function secureCookieEnabled(database: DatabaseSync): Promise<boolean> {
  const setting = getServerSettings(database).secureCookieMode;
  if (setting === "always") return true;
  if (setting === "never") return false;
  if (process.env.DM_COMMAND_TABLE_TRUST_PROXY !== "true") return false;
  const { headers } = await import("next/headers");
  const requestHeaders = await headers();
  return (
    requestHeaders
      .get("x-forwarded-proto")
      ?.split(",")
      .some((value) => value.trim() === "https") ?? false
  );
}
