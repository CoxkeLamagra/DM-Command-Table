import { statement } from "../../db/statements.ts";
import type { DatabaseSync } from "node:sqlite";
import { runTransaction } from "../../db/transaction.ts";
import type { RateLimitResult } from "./rate-limit.ts";

const cleanupTimes = new WeakMap<DatabaseSync, number>();
export function consumePersistentRateLimit(
  database: DatabaseSync,
  key: string,
  limit: number,
  windowMs: number,
  now = Date.now(),
): RateLimitResult {
  return consumePersistentRateLimits(database, [{ key, limit, windowMs }], now);
}
// Read all budgets before any increment, in one transaction and without nested savepoints.
export function consumePersistentRateLimits(
  database: DatabaseSync,
  limits: { key: string; limit: number; windowMs: number }[],
  now = Date.now(),
): RateLimitResult {
  if (new Set(limits.map((value) => value.key)).size !== limits.length)
    throw new Error("Rate-limit keys must be unique");
  return runTransaction(database, () => {
    if (now - (cleanupTimes.get(database) ?? 0) >= 60000) {
      statement(
        database,
        "DELETE FROM security_rate_limits WHERE resets_at<=?",
      ).run(now);
      cleanupTimes.set(database, now);
    }
    const lookup = statement(
      database,
      "SELECT count,resets_at AS resetsAt FROM security_rate_limits WHERE key=?",
    );
    const current = limits.map(
      ({ key }) =>
        lookup.get(key) as { count: number; resetsAt: number } | undefined,
    );
    for (let i = 0; i < limits.length; i++) {
      const row = current[i];
      if (row && row.resetsAt > now && row.count >= limits[i].limit)
        return {
          allowed: false,
          retryAfterSeconds: Math.max(
            1,
            Math.ceil((row.resetsAt - now) / 1000),
          ),
        };
    }
    const upsert = statement(
      database,
      "INSERT INTO security_rate_limits(key,count,resets_at,updated_at) VALUES(?,?,?,?) ON CONFLICT(key) DO UPDATE SET count=excluded.count,resets_at=excluded.resets_at,updated_at=excluded.updated_at",
    );
    limits.forEach(({ key, windowMs }, i) => {
      const row = current[i];
      const active = row && row.resetsAt > now;
      upsert.run(
        key,
        active ? row.count + 1 : 1,
        active ? row.resetsAt : now + windowMs,
        now,
      );
    });
    return { allowed: true };
  });
}
