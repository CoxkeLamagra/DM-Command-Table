import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { getDatabase } from "@/db/sqlite";
import type { LocalUser } from "./credentials";

const COOKIE_NAME = "dmct_session";
const SESSION_SECONDS = 60 * 60 * 24 * 30;

export async function getLocalUser(): Promise<LocalUser | null> {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;
  const now = Date.now();
  const db = getDatabase();
  db.prepare("DELETE FROM local_sessions WHERE expires_at <= ?").run(now);
  const row = db
    .prepare(
      `SELECT u.id AS userId, u.username, u.display_name AS displayName,
              u.is_admin AS isAdmin
       FROM local_sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ? AND s.expires_at > ? AND u.username IS NOT NULL
       LIMIT 1`,
    )
    .get(hashToken(token), now) as LocalUser | undefined;
  return row ?? null;
}

export async function createSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const now = Date.now();
  getDatabase()
    .prepare(
      "INSERT INTO local_sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)",
    )
    .run(hashToken(token), userId, now + SESSION_SECONDS * 1000, now);
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
  if (token) {
    getDatabase()
      .prepare("DELETE FROM local_sessions WHERE token_hash = ?")
      .run(hashToken(token));
  }
  store.set(COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.DM_COMMAND_TABLE_SECURE_COOKIES === "true",
    path: "/",
    maxAge: 0,
  });
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
