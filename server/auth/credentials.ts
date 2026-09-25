import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { getDatabase } from "../../db/sqlite.ts";

const USERNAME_PATTERN = /^[a-zA-Z0-9_-]{3,32}$/;

export type LocalUser = {
  userId: string;
  username: string;
  displayName: string;
  isAdmin: boolean;
};

type UserRow = LocalUser & { passwordHash: string };

export function normaliseUsername(value: string): string {
  return value.trim().toLowerCase();
}

export function validateCredentials(
  username: string,
  password: string,
): string | null {
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
    const actual = scryptSync(
      password,
      Buffer.from(saltValue, "base64"),
      expected.length,
    );
    return (
      expected.length === actual.length && timingSafeEqual(expected, actual)
    );
  } catch {
    return false;
  }
}

export function findLocalUser(username: string): UserRow | null {
  return (
    (getDatabase()
      .prepare(
        `SELECT id AS userId, username, display_name AS displayName, password_hash AS passwordHash,
                is_admin AS isAdmin
         FROM users WHERE username = ? LIMIT 1`,
      )
      .get(normaliseUsername(username)) as UserRow | undefined) ?? null
  );
}
