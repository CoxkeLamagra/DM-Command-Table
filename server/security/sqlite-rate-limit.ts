import type { DatabaseSync } from "node:sqlite";
import { runTransaction } from "../../db/transaction.ts";
import type { RateLimitResult } from "./rate-limit.ts";

const CLEANUP_INTERVAL_MS = 60_000;
let lastCleanup = 0;

export function consumePersistentRateLimit(
  database: DatabaseSync,
  key: string,
  limit: number,
  windowMs: number,
  now = Date.now(),
): RateLimitResult {
  if (now - lastCleanup >= CLEANUP_INTERVAL_MS) {
    database
      .prepare("DELETE FROM security_rate_limits WHERE resets_at <= ?")
      .run(now);
    lastCleanup = now;
  }

  return runTransaction(database, () => {
    const current = database
      .prepare(
        "SELECT count, resets_at AS resetsAt FROM security_rate_limits WHERE key = ?",
      )
      .get(key) as { count: number; resetsAt: number } | undefined;

    if (!current || current.resetsAt <= now) {
      database
        .prepare(
          `INSERT INTO security_rate_limits (key, count, resets_at, updated_at)
         VALUES (?, 1, ?, ?)
         ON CONFLICT(key) DO UPDATE SET
           count = 1, resets_at = excluded.resets_at, updated_at = excluded.updated_at`,
        )
        .run(key, now + windowMs, now);
      return { allowed: true };
    }

    if (current.count >= limit) {
      return {
        allowed: false,
        retryAfterSeconds: Math.max(
          1,
          Math.ceil((current.resetsAt - now) / 1000),
        ),
      };
    }

    database
      .prepare(
        "UPDATE security_rate_limits SET count = count + 1, updated_at = ? WHERE key = ?",
      )
      .run(now, key);
    return { allowed: true };
  });
}

// Admission is atomic: a rejected request cannot spend any of its budgets.
export function consumePersistentRateLimits(
  database: DatabaseSync,
  limits: { key: string; limit: number; windowMs: number }[],
  now = Date.now(),
): RateLimitResult {
  return runTransaction(database, () => {
    for (const { key, limit } of limits) {
      const current = database
        .prepare(
          "SELECT count, resets_at AS resetsAt FROM security_rate_limits WHERE key = ?",
        )
        .get(key) as { count: number; resetsAt: number } | undefined;
      if (current && current.resetsAt > now && current.count >= limit)
        return {
          allowed: false,
          retryAfterSeconds: Math.max(
            1,
            Math.ceil((current.resetsAt - now) / 1000),
          ),
        };
    }
    for (const { key, limit, windowMs } of limits)
      consumePersistentRateLimit(database, key, limit, windowMs, now);
    return { allowed: true };
  });
}
