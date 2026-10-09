import { PublicApiError } from "../http/errors.ts";
import type { DatabaseSync } from "node:sqlite";
import { consumePersistentRateLimits } from "./sqlite-rate-limit.ts";
import { normaliseUsername } from "./passwords.ts";
import type { RateLimitResult } from "./rate-limit.ts";

export function consumeAuthRateLimit(
  database: DatabaseSync,
  action: "login" | "register",
  source: string,
  username: string,
  now = Date.now(),
): RateLimitResult {
  const login = action === "login";
  const windowMs = login ? 15 * 60 * 1000 : 60 * 60 * 1000;
  const limits: [string, number][] = [
    [`auth:${action}:source:${source}`, login ? 30 : 10],
    [`auth:${action}:${source}:${normaliseUsername(username)}`, login ? 10 : 5],
    [`auth:${action}:global`, login ? 300 : 30],
  ];
  return consumePersistentRateLimits(
    database,
    limits.map(([key, limit]) => ({ key, limit, windowMs })),
    now,
  );
}

let activeAuthOperations = 0;

export async function withAuthWork<T>(operation: () => Promise<T>): Promise<T> {
  if (activeAuthOperations >= 4)
    throw new PublicApiError("Sign-in is busy. Please try again shortly.", 503);
  activeAuthOperations++;
  try {
    return await operation();
  } finally {
    activeAuthOperations--;
  }
}
