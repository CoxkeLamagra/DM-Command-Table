import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { runMigrations } from "../db/migrations.ts";
import { getV6ServerSettings, saveV6ServerSettings } from "../server/v6/server-settings.ts";

function fixture() {
  const database = new DatabaseSync(":memory:");
  runMigrations(database);
  return database;
}

test("server settings use safe defaults and persist locally", () => {
  const database = fixture();
  assert.deepEqual(getV6ServerSettings(database), {
    secureCookieMode: "auto",
    sessionLifetimeDays: 30,
    uploadLimitMb: 8,
    screenshotQuotaMb: 100,
    screenshotGlobalQuotaMb: 1024,
    combatHistoryLimit: 100,
    auditEventLimit: 10_000,
  });
  const changed = saveV6ServerSettings(database, {
    secureCookieMode: "always",
    sessionLifetimeDays: 14,
    uploadLimitMb: 16,
    screenshotQuotaMb: 250,
    screenshotGlobalQuotaMb: 5000,
    combatHistoryLimit: 40,
    auditEventLimit: 20_000,
  });
  assert.deepEqual(getV6ServerSettings(database), changed);
  assert.equal(
    (database.prepare("SELECT value FROM application_settings WHERE key = 'server.upload_limit_mb'").get() as { value: string }).value,
    "16",
  );
  database.close();
});

test("server settings reject unsafe or unbounded values without partial writes", () => {
  const database = fixture();
  assert.throws(() => saveV6ServerSettings(database, {
    ...getV6ServerSettings(database),
    uploadLimitMb: 500,
  }));
  const result = database.prepare(
    "SELECT COUNT(*) AS count FROM application_settings WHERE key LIKE 'server.%'",
  ).get() as { count: number };
  assert.equal(result.count, 0);
  database.close();
});
