import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { getV6Database } from "../../db/v6-sqlite.ts";
import {
  hashPassword,
  normaliseUsername,
  validateCredentials,
  verifyPassword,
  passwordHashNeedsUpgrade,
} from "../security/passwords.ts";
import { PublicApiError } from "./errors.ts";
import { getV6ServerSettings } from "./server-settings.ts";
import { runTransaction } from "../../db/transaction.ts";

const DUMMY_PASSWORD_HASH =
  "scrypt-v1$AAAAAAAAAAAAAAAAAAAAAA==$" + Buffer.alloc(64).toString("base64");

const sessionCleanup = new WeakMap<DatabaseSync, number>();

const COOKIE_NAME = "dmct_v6_session";

export type V6User = {
  userId: string;
  username: string;
  displayName: string;
  isAdmin: boolean;
};

type UserRow = Omit<V6User, "isAdmin"> & {
  isAdmin: number;
  passwordHash?: string;
};

export function registrationStatus(database = getV6Database()) {
  const count = database
    .prepare("SELECT COUNT(*) AS count FROM users")
    .get() as { count: number };
  const setting = database
    .prepare(
      "SELECT value FROM application_settings WHERE key = 'registration_enabled'",
    )
    .get() as { value: string } | undefined;
  return {
    initialSetup: count.count === 0,
    registrationEnabled: count.count === 0 || setting?.value === "true",
  };
}

export function setRegistrationEnabled(
  database: DatabaseSync,
  enabled: boolean,
): void {
  database
    .prepare(
      `INSERT INTO application_settings (key, value, updated_at)
     VALUES ('registration_enabled', ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    )
    .run(enabled ? "true" : "false", Date.now());
}

export async function registerV6User(
  database: DatabaseSync,
  input: {
    username: string;
    displayName: string;
    password: string;
    bootstrapToken?: string;
  },
): Promise<V6User> {
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

export async function createV6ManagedUserRecord(
  database: DatabaseSync,
  input: { username: string; displayName: string; password: string },
): Promise<V6User> {
  const username = normaliseUsername(input.username);
  const validation = validateCredentials(username, input.password);
  if (validation) throw new PublicApiError(validation);
  const passwordHash = await hashPassword(input.password);
  return runTransaction(database, () =>
    createUserRecord(database, input, passwordHash, false),
  );
}

export async function authenticateV6User(
  database: DatabaseSync,
  usernameValue: string,
  password: string,
): Promise<V6User | null> {
  const row = database
    .prepare(
      `SELECT id AS userId, username, display_name AS displayName,
            is_admin AS isAdmin, password_hash AS passwordHash
       FROM users WHERE username = ? COLLATE NOCASE LIMIT 1`,
    )
    .get(normaliseUsername(usernameValue)) as UserRow | undefined;
  const valid = await verifyPassword(
    password,
    row?.passwordHash ?? DUMMY_PASSWORD_HASH,
  );
  if (!row?.passwordHash || !valid) return null;
  if (passwordHashNeedsUpgrade(row.passwordHash))
    database
      .prepare(
        "UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?",
      )
      .run(await hashPassword(password), Date.now(), row.userId);
  return toUser(row);
}

export async function getV6User(
  database = getV6Database(),
): Promise<V6User | null> {
  const { cookies } = await import("next/headers");
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;
  const now = Date.now();
  if (now - (sessionCleanup.get(database) ?? 0) >= 60_000) {
    database
      .prepare("DELETE FROM local_sessions WHERE expires_at <= ?")
      .run(now);
    sessionCleanup.set(database, now);
  }
  const row = database
    .prepare(
      `SELECT u.id AS userId, u.username, u.display_name AS displayName,
            u.is_admin AS isAdmin
       FROM local_sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = ? AND s.expires_at > ? LIMIT 1`,
    )
    .get(hashToken(token), now) as UserRow | undefined;
  return row ? toUser(row) : null;
}

export async function createV6Session(
  userId: string,
  database = getV6Database(),
): Promise<void> {
  const { cookies } = await import("next/headers");
  const token = randomBytes(32).toString("base64url");
  const now = Date.now();
  const sessionSeconds =
    getV6ServerSettings(database).sessionLifetimeDays * 24 * 60 * 60;
  database
    .prepare(
      "INSERT INTO local_sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)",
    )
    .run(hashToken(token), userId, now + sessionSeconds * 1000, now);
  (await cookies()).set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: await secureCookieEnabled(database),
    path: "/",
    maxAge: sessionSeconds,
  });
}

export async function destroyV6Session(
  database = getV6Database(),
): Promise<void> {
  const { cookies } = await import("next/headers");
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (token)
    database
      .prepare("DELETE FROM local_sessions WHERE token_hash = ?")
      .run(hashToken(token));
  store.set(COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: await secureCookieEnabled(database),
    path: "/",
    maxAge: 0,
  });
}

function toUser(row: UserRow): V6User {
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
): V6User {
  const username = normaliseUsername(input.username);
  if (
    database
      .prepare("SELECT id FROM users WHERE username = ? COLLATE NOCASE")
      .get(username)
  )
    throw new PublicApiError("That username is already registered.", 409);
  const user: V6User = {
    userId: crypto.randomUUID(),
    username,
    displayName: input.displayName.trim().slice(0, 80) || username,
    isAdmin,
  };
  const now = Date.now();
  database
    .prepare(
      `INSERT INTO users
      (id, display_name, username, password_hash, is_admin, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      user.userId,
      user.displayName,
      user.username,
      passwordHash,
      user.isAdmin ? 1 : 0,
      now,
      now,
    );
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
  const setting = getV6ServerSettings(database).secureCookieMode;
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
