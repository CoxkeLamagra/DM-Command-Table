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
  return `scrypt-v1$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  if (password.length > 128) return false;
  const [algorithm, saltValue, hashValue] = stored.split("$");
  if (!["scrypt", "scrypt-v1"].includes(algorithm) || !saltValue || !hashValue)
    return false;
  try {
    const expected = Buffer.from(hashValue, "base64");
    if (
      expected.length !== 64 ||
      Buffer.from(saltValue, "base64").length !== 16
    )
      return false;
    const actual = await derive(
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

export function passwordHashNeedsUpgrade(stored: string): boolean {
  return !stored.startsWith("scrypt-v1$");
}

function derive(
  password: string,
  salt: Buffer,
  length: number,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password,
      salt,
      length,
      { N: 16_384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 },
      (error, value) => {
        if (error) reject(error);
        else resolve(value);
      },
    );
  });
}
