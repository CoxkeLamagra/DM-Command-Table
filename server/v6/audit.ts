import type { DatabaseSync } from "node:sqlite";
import { getV6ServerSettings } from "./server-settings.ts";

export function recordAuditEvent(
  database: DatabaseSync,
  input: {
    campaignId?: string | null;
    actorUserId?: string | null;
    resourceType: string;
    resourceId?: string | null;
    action: string;
    details?: unknown;
  },
): void {
  database
    .prepare(
      `INSERT INTO audit_events
        (campaign_id, actor_user_id, resource_type, resource_id, action, details, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.campaignId ?? null,
      input.actorUserId ?? null,
      input.resourceType,
      input.resourceId ?? null,
      input.action,
      input.details === undefined ? null : JSON.stringify(input.details),
      Date.now(),
    );
  pruneAuditEvents(database, input.campaignId ?? null, input.actorUserId ?? null);
}

function pruneAuditEvents(
  database: DatabaseSync,
  campaignId: string | null,
  actorUserId: string | null,
): void {
  const limit = getV6ServerSettings(database).auditEventLimit;
  const campaign = campaignId !== null;
  const owner = campaignId ?? actorUserId;
  if (!owner) return;
  const column = campaign ? "campaign_id" : "actor_user_id";
  const cutoff = database.prepare(
    `SELECT id FROM audit_events WHERE ${column} = ? ORDER BY id DESC LIMIT 1 OFFSET ?`,
  ).get(owner, limit) as { id: number } | undefined;
  if (cutoff)
    database.prepare(`DELETE FROM audit_events WHERE ${column} = ? AND id <= ?`).run(owner, cutoff.id);
}
