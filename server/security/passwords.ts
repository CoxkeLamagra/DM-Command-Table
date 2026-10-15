import { PublicApiError } from "../http/errors.ts";
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

const USERNAME_PATTERN = /^[a-zA-Z0-9_-]{3,32}$/;

export function normaliseUsername(value: string): string {
  return value.trim().toLowerCase();
}

export function validateCredentials(
  username: string,
  password: string,
): string | null {
  if (!USERNAME_PATTERN.test(username.trim()))
    return "Username must be 3–32 characters and use only letters, numbers, underscores, or hyphens.";
  if (password.length < 8 || password.length > 128)
    return "Password must be between 8 and 128 characters.";
  return null;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await derive(password, salt, 64);
  return `scrypt-v2$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  if (password.length > 128) return false;
  const [algorithm, saltValue, hashValue, extra] = stored.split("$");
  if (
    !["scrypt-v1", "scrypt-v2"].includes(algorithm) ||
    !saltValue ||
    !hashValue ||
    extra !== undefined
  )
    return false;
  try {
    const expected = Buffer.from(hashValue, "base64");
    if (
      expected.length !== 64 ||
      Buffer.from(saltValue, "base64").length !== 16
    )
      return false;
    // Both supported formats perform both work profiles, avoiding a large
    // account-existence timing difference during the gradual upgrade.
    const salt = Buffer.from(saltValue, "base64");
    const legacy = await derive(password, salt, expected.length, true);
    const current = await derive(password, salt, expected.length);
    const actual = algorithm === "scrypt-v1" ? legacy : current;
    return (
      expected.length === actual.length && timingSafeEqual(expected, actual)
    );
  } catch (error) {
    if (error instanceof PublicApiError) throw error;
    return false;
  }
}

let activePasswordWork = 0;

function derive(
  password: string,
  salt: Buffer,
  length: number,
  legacy = false,
): Promise<Buffer> {
  if (activePasswordWork >= 4)
    return Promise.reject(
      new PublicApiError(
        "Password processing is busy. Please try again shortly.",
        503,
      ),
    );
  activePasswordWork++;
  return new Promise<Buffer>((resolve, reject) => {
    scrypt(
      password,
      salt,
      length,
      {
        N: legacy ? 16_384 : 32_768,
        r: 8,
        p: legacy ? 1 : 3,
        maxmem: 64 * 1024 * 1024,
      },
      (error, value) => {
        if (error) reject(error);
        else resolve(value);
      },
    );
  }).finally(() => {
    activePasswordWork--;
  });
}
