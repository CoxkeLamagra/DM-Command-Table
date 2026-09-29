import type { DatabaseSync } from "node:sqlite";
import { clientAddress, rateLimitResponse } from "../security/rate-limit.ts";
import { consumePersistentRateLimit } from "../security/sqlite-rate-limit.ts";

export function enforceV6RateLimit(
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
