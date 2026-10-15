import { statement } from "../../db/statements.ts";
import type { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { statSync, statfsSync } from "node:fs";
import { PublicApiError } from "../http/errors.ts";

function setting(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 1)
    throw new Error(`${name} must be a positive integer.`);
  return value;
}
export function storageLimits() {
  return {
    databaseLimitMb: setting("DM_COMMAND_TABLE_DATABASE_LIMIT_MB", 1024),
    minimumFreeMb: setting("DM_COMMAND_TABLE_MIN_FREE_SPACE_MB", 128),
    campaignsPerAccount: setting("DM_COMMAND_TABLE_CAMPAIGNS_PER_ACCOUNT", 100),
    recordsPerAccount: setting("DM_COMMAND_TABLE_RECORDS_PER_ACCOUNT", 100000),
  };
}
function number(database: DatabaseSync, sql: string): number {
  return Number(Object.values(statement(database, sql).get()!)[0]);
}
export function usedDatabaseBytes(database: DatabaseSync): number {
  return (
    (number(database, "PRAGMA page_count") -
      number(database, "PRAGMA freelist_count")) *
    number(database, "PRAGMA page_size")
  );
}
function databaseFilename(database: DatabaseSync) {
  return (
    statement(database, "PRAGMA database_list").all() as Array<{
      name: string;
      file: string;
    }>
  ).find((entry) => entry.name === "main")?.file;
}
export function databaseUsage(database: DatabaseSync) {
  const usedBytes = usedDatabaseBytes(database);
  const filename = databaseFilename(database);
  let databaseBytes = 0,
    walBytes = 0,
    freeBytes: number | null = null;
  if (filename) {
    try {
      databaseBytes = statSync(filename).size;
    } catch {}
    try {
      walBytes = statSync(filename + "-wal").size;
    } catch {}
    const fs = statfsSync(path.dirname(filename));
    freeBytes = fs.bavail * fs.bsize;
  }
  return {
    usedBytes,
    databaseBytes,
    walBytes,
    freeBytes,
    limits: storageLimits(),
  };
}
export function assertDatabaseGrowth(
  database: DatabaseSync,
  beforeUsedBytes: number,
) {
  const usedBytes = usedDatabaseBytes(database);
  // Existing over-budget installations can still shrink, delete and remediate.
  if (usedBytes <= beforeUsedBytes) return;
  const limits = storageLimits();
  const filename = databaseFilename(database);
  const fs = filename ? statfsSync(path.dirname(filename)) : null;
  if (
    usedBytes > limits.databaseLimitMb * 1048576 ||
    (fs && fs.bavail * fs.bsize < limits.minimumFreeMb * 1048576)
  )
    throw new PublicApiError(
      "Local database growth budget reached. Remove unused data or ask the host administrator to increase storage limits.",
      413,
    );
}
export function assertAccountBudget(database: DatabaseSync, ownerId: string) {
  const limits = storageLimits();
  const campaigns = Number(
    statement(
      database,
      "SELECT COUNT(*) AS n FROM campaigns WHERE owner_id=?",
    ).get(ownerId)!.n,
  );
  if (campaigns > limits.campaignsPerAccount)
    throw new PublicApiError("Account campaign limit reached.", 413);
  const records = Number(
    statement(
      database,
      `SELECT
    (SELECT COUNT(*) FROM players p JOIN campaigns c ON c.id=p.campaign_id WHERE c.owner_id=?) +
    (SELECT COUNT(*) FROM monsters m JOIN campaigns c ON c.id=m.campaign_id WHERE c.owner_id=?) +
    (SELECT COUNT(*) FROM sessions s JOIN campaigns c ON c.id=s.campaign_id WHERE c.owner_id=?) +
    (SELECT COUNT(*) FROM story_beats s JOIN campaigns c ON c.id=s.campaign_id WHERE c.owner_id=?) +
    (SELECT COUNT(*) FROM prepared_encounters e JOIN sessions s ON s.id=e.session_id JOIN campaigns c ON c.id=s.campaign_id WHERE c.owner_id=?) +
    (SELECT COUNT(*) FROM tags t JOIN campaigns c ON c.id=t.campaign_id WHERE c.owner_id=?) +
    (SELECT COUNT(*) FROM session_templates WHERE owner_id=?) AS n`,
    ).get(ownerId, ownerId, ownerId, ownerId, ownerId, ownerId, ownerId)!.n,
  );
  if (records > limits.recordsPerAccount)
    throw new PublicApiError("Account record limit reached.", 413);
}
export function assertCampaignAccountBudget(
  database: DatabaseSync,
  campaignId: string,
) {
  const owner = statement(
    database,
    "SELECT owner_id AS id FROM campaigns WHERE id=?",
  ).get(campaignId) as { id: string } | undefined;
  if (owner) assertAccountBudget(database, owner.id);
}

export function applyDatabasePageLimit(database: DatabaseSync) {
  const currentPages = number(database, "PRAGMA page_count");
  const pageSize = number(database, "PRAGMA page_size");
  const maximum = Math.max(
    currentPages,
    Math.floor((storageLimits().databaseLimitMb * 1048576) / pageSize),
  );
  if (maximum > 4294967294)
    throw new Error(
      "Configured database budget exceeds SQLite's supported page limit.",
    );
  database.exec(`PRAGMA max_page_count=${maximum}`);
}
