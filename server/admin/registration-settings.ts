import { getDatabase } from "../../db/sqlite.ts";

const REGISTRATION_KEY = "account_registration_enabled";

export type RegistrationStatus = {
  initialSetup: boolean;
  registrationEnabled: boolean;
};

export function getRegistrationStatus(): RegistrationStatus {
  const database = getDatabase();
  const counts = database
    .prepare(
      "SELECT COUNT(*) AS users, COALESCE(SUM(CASE WHEN is_admin = 1 THEN 1 ELSE 0 END), 0) AS administrators FROM users",
    )
    .get() as { users: number; administrators: number };
  const initialSetup = counts.users === 0;
  const setting = database
    .prepare("SELECT value FROM application_settings WHERE key = ? LIMIT 1")
    .get(REGISTRATION_KEY) as { value: string } | undefined;

  return {
    initialSetup,
    registrationEnabled:
      initialSetup ||
      (counts.administrators > 0 &&
        (setting
          ? setting.value === "true"
          : process.env.DM_COMMAND_TABLE_REGISTRATION_MODE === "open")),
  };
}

export function setRegistrationEnabled(enabled: boolean): void {
  getDatabase()
    .prepare(
      `INSERT INTO application_settings (key, value, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    )
    .run(REGISTRATION_KEY, enabled ? "true" : "false", Date.now());
}
