import type { DatabaseSync } from "node:sqlite";
import { z } from "zod";

export const serverSettingsSchema = z.object({
  secureCookieMode: z.enum(["auto", "always", "never"]),
  sessionLifetimeDays: z.number().int().min(1).max(365),
  uploadLimitMb: z.number().int().min(1).max(50),
  screenshotQuotaMb: z.number().int().min(1).max(10_000),
  screenshotGlobalQuotaMb: z.number().int().min(1).max(100_000),
  combatHistoryLimit: z.number().int().min(1).max(1_000),
  auditEventLimit: z.number().int().min(100).max(100_000),
});

export type ServerSettings = z.infer<typeof serverSettingsSchema>;

const keys: Record<keyof ServerSettings, string> = {
  secureCookieMode: "server.secure_cookie_mode",
  sessionLifetimeDays: "server.session_lifetime_days",
  uploadLimitMb: "server.upload_limit_mb",
  screenshotQuotaMb: "server.screenshot_quota_mb",
  screenshotGlobalQuotaMb: "server.screenshot_global_quota_mb",
  combatHistoryLimit: "server.combat_history_limit",
  auditEventLimit: "server.audit_event_limit",
};

export function getServerSettings(database: DatabaseSync): ServerSettings {
  const stored = new Map(
    (
      database
        .prepare(
          "SELECT key, value FROM application_settings WHERE key LIKE 'server.%'",
        )
        .all() as Array<{ key: string; value: string }>
    ).map(({ key, value }) => [key, value]),
  );
  return serverSettingsSchema.parse({
    secureCookieMode:
      stored.get(keys.secureCookieMode) ?? cookieModeFromEnvironment(),
    sessionLifetimeDays: integer(
      stored.get(keys.sessionLifetimeDays),
      undefined,
      30,
      1,
      365,
    ),
    uploadLimitMb: integer(stored.get(keys.uploadLimitMb), undefined, 8, 1, 50),
    screenshotQuotaMb: integer(
      stored.get(keys.screenshotQuotaMb),
      process.env.DM_COMMAND_TABLE_SCREENSHOT_QUOTA_MB,
      100,
      1,
      10_000,
    ),
    screenshotGlobalQuotaMb: integer(
      stored.get(keys.screenshotGlobalQuotaMb),
      process.env.DM_COMMAND_TABLE_SCREENSHOT_GLOBAL_QUOTA_MB,
      1024,
      1,
      100_000,
    ),
    combatHistoryLimit: integer(
      stored.get(keys.combatHistoryLimit),
      process.env.DM_COMMAND_TABLE_COMBAT_HISTORY_LIMIT,
      100,
      1,
      1_000,
    ),
    auditEventLimit: integer(
      stored.get(keys.auditEventLimit),
      process.env.DM_COMMAND_TABLE_AUDIT_EVENT_LIMIT,
      10_000,
      100,
      100_000,
    ),
  });
}

export function saveServerSettings(
  database: DatabaseSync,
  input: unknown,
): ServerSettings {
  const settings = serverSettingsSchema.parse(input);
  const statement = database.prepare(
    `INSERT INTO application_settings (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
  );
  const now = Date.now();
  database.exec("BEGIN IMMEDIATE");
  try {
    for (const [property, key] of Object.entries(keys) as Array<
      [keyof ServerSettings, string]
    >)
      statement.run(key, String(settings[property]), now);
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
  return settings;
}

function integer(
  stored: string | undefined,
  environment: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  const value = Number(stored ?? environment);
  return Number.isInteger(value) && value >= minimum && value <= maximum
    ? value
    : fallback;
}

function cookieModeFromEnvironment(): ServerSettings["secureCookieMode"] {
  const value = process.env.DM_COMMAND_TABLE_SECURE_COOKIES ?? "auto";
  return value === "true" ? "always" : value === "false" ? "never" : "auto";
}
