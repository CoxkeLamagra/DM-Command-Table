import type { DatabaseSync } from "node:sqlite";
import { clientAddress, rateLimitResponse } from "../security/rate-limit.ts";
import { consumePersistentRateLimit } from "../security/sqlite-rate-limit.ts";

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

/**
 * Persistent per-account, per-client request budgets. `scope` is the stored
 * bucket name: policies that share a scope share one counter (application
 * updates and administrator user updates both count against `admin-update`).
 */
export const RATE_LIMITS = {
  write: { scope: "write", limit: 300, windowMs: 15 * MINUTE },
  import: { scope: "import", limit: 10, windowMs: HOUR },
  account: { scope: "account", limit: 60, windowMs: HOUR },
  password: { scope: "password", limit: 10, windowMs: HOUR },
  screenshotUpload: { scope: "screenshot-upload", limit: 30, windowMs: HOUR },
  screenshotDelete: { scope: "screenshot-delete", limit: 60, windowMs: HOUR },
  adminCreate: { scope: "admin-create", limit: 20, windowMs: HOUR },
  adminUpdate: { scope: "admin-update", limit: 30, windowMs: HOUR },
  adminDelete: { scope: "admin-delete", limit: 20, windowMs: HOUR },
  applicationUpdate: { scope: "admin-update", limit: 6, windowMs: HOUR },
} as const;

export type RateLimitName = keyof typeof RATE_LIMITS;

/** Charges one request to the named budget; returns a 429 response when spent. */
export function rateLimited(
  database: DatabaseSync,
  request: Request,
  name: RateLimitName,
  subject: string,
): Response | null {
  const { scope, limit, windowMs } = RATE_LIMITS[name];
  return enforceRateLimit(database, request, scope, subject, limit, windowMs);
}

export function enforceRateLimit(
  database: DatabaseSync,
  request: Request,
  scope: string,
  subject: string,
  limit: number,
  windowMs: number,
): Response | null {
  const result = consumePersistentRateLimit(
    database,
    `${scope}:${subject}:${clientAddress(request)}`,
    limit,
    windowMs,
  );
  return result.allowed ? null : rateLimitResponse(result.retryAfterSeconds);
}
