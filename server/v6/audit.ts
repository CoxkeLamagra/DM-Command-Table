import type { DatabaseSync } from "node:sqlite";

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
}

