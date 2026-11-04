import type { DatabaseSync } from "node:sqlite";
import { rateLimitResponse } from "../security/rate-limit.ts";
import { consumePersistentRateLimit } from "../security/sqlite-rate-limit.ts";

export function enforceRateLimit(
  database: DatabaseSync,
  _request: Request,
  scope: string,
  subject: string,
  limit: number,
  windowMs: number,
): Response | null {
  const result = consumePersistentRateLimit(
    database,
    `${scope}:${subject}`,
    limit,
    windowMs,
  );
  return result.allowed ? null : rateLimitResponse(result.retryAfterSeconds);
}
