import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { getDatabase } from "@/db/sqlite";

const COOKIE_NAME = "dmct_session";
const SESSION_SECONDS = 60 * 60 * 24 * 30;
const USERNAME_PATTERN = /^[a-zA-Z0-9_-]{3,32}$/;

export type LocalUser = {
  userId: string;
  username: string;
  displayName: string;
};

type UserRow = LocalUser & { passwordHash: string };

export function normaliseUsername(value: string): string {
  return value.trim().toLowerCase();
}

export function validateCredentials(username: string, password: string): string | null {
  if (!USERNAME_PATTERN.test(username.trim())) {
    return "Username must be 3–32 characters and use only letters, numbers, underscores, or hyphens.";
  }
  if (password.length < 8 || password.length > 128) {
    return "Password must be between 8 and 128 characters.";
  }
  return null;
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `scrypt$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [algorithm, saltValue, hashValue] = stored.split("$");
  if (algorithm !== "scrypt" || !saltValue || !hashValue) return false;
  try {
    const expected = Buffer.from(hashValue, "base64");
    const actual = scryptSync(password, Buffer.from(saltValue, "base64"), expected.length);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

export async function getLocalUser(): Promise<LocalUser | null> {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;
  const now = Date.now();
  const db = getDatabase();
  db.prepare("DELETE FROM local_sessions WHERE expires_at <= ?").run(now);
  const row = db.prepare(
    `SELECT u.id AS userId, u.username, u.display_name AS displayName
     FROM local_sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ? AND s.expires_at > ? AND u.username IS NOT NULL
     LIMIT 1`,
  ).get(hashToken(token), now) as LocalUser | undefined;
  return row ?? null;
}

export function findLocalUser(username: string): UserRow | null {
  return (getDatabase().prepare(
    `SELECT id AS userId, username, display_name AS displayName, password_hash AS passwordHash
     FROM users WHERE username = ? AND password_hash IS NOT NULL LIMIT 1`,
  ).get(normaliseUsername(username)) as UserRow | undefined) ?? null;
}

export async function createSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const now = Date.now();
  getDatabase().prepare(
    "INSERT INTO local_sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)",
  ).run(hashToken(token), userId, now + SESSION_SECONDS * 1000, now);
  (await cookies()).set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.DM_COMMAND_TABLE_SECURE_COOKIES === "true",
    path: "/",
    maxAge: SESSION_SECONDS,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (token) getDatabase().prepare("DELETE FROM local_sessions WHERE token_hash = ?").run(hashToken(token));
  store.set(COOKIE_NAME, "", { httpOnly: true, sameSite: "lax", secure: process.env.DM_COMMAND_TABLE_SECURE_COOKIES === "true", path: "/", maxAge: 0 });
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
