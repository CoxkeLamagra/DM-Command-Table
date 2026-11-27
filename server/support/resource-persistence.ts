import { assertCampaignAccountBudget } from "../security/storage-budget.ts";
import { statement } from "../../db/statements.ts";
import type { DatabaseSync } from "node:sqlite";
import { recordAuditEvent } from "../support/audit.ts";
import { removeSearchEntry, writeSearchEntry } from "./search-index.ts";
import {
  ResourceNotFoundError,
  RevisionConflictError,
} from "../http/conflicts.ts";
export function index(
  database: DatabaseSync,
  campaignId: string,
  type: string,
  id: string,
  title: string,
  content: string,
) {
  writeSearchEntry(database, campaignId, type, id, title, content);
}

export function removeIndex(
  database: DatabaseSync,
  campaignId: string,
  type: string,
  id: string,
) {
  removeSearchEntry(database, campaignId, type, id);
}

export function assertUpdated(
  database: DatabaseSync,
  table:
    | "players"
    | "sessions"
    | "story_beats"
    | "prepared_encounters"
    | "combat_encounters",
  resourceType: string,
  id: string,
  expectedRevision: number,
  changes: number | bigint,
  campaignId: string,
): void {
  if (Number(changes) !== 0) return;
  const actual = statement(
    database,
    table === "prepared_encounters"
      ? `SELECT revision FROM prepared_encounters WHERE id=? AND session_id IN (SELECT id FROM sessions WHERE campaign_id=?)`
      : `SELECT revision FROM ${table} WHERE id=? AND campaign_id=?`,
  ).get(id, campaignId) as { revision: number } | undefined;
  if (!actual) throw new ResourceNotFoundError(resourceType, id);
  throw new RevisionConflictError(
    resourceType,
    id,
    expectedRevision,
    actual.revision,
  );
}

export function changed(
  database: DatabaseSync,
  campaignId: string,
  actorUserId: string,
  resourceType: string,
  resourceId: string,
  action: string,
): void {
  if (action === "created" || action === "tag_created")
    assertCampaignAccountBudget(database, campaignId);
  statement(
    database,
    "UPDATE campaigns SET revision = revision + 1, updated_at = ? WHERE id = ?",
  ).run(Date.now(), campaignId);
  recordAuditEvent(database, {
    campaignId,
    actorUserId,
    resourceType,
    resourceId,
    action,
  });
}
export function withTimestamps<
  T extends { createdAt: number; updatedAt: number },
>(
  row: T,
): Omit<T, "createdAt" | "updatedAt"> & {
  createdAt: string;
  updatedAt: string;
} {
  return {
    ...row,
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString(),
  };
}
