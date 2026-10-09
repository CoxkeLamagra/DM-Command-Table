import { sanitizeRichText } from "../security/sanitize-rich-text.ts";
import type { DatabaseSync } from "node:sqlite";
import {
  RevisionConflictError,
  ResourceNotFoundError,
} from "../http/conflicts.ts";
import { PublicApiError } from "../http/errors.ts";
import { getServerSettings } from "../administration/server-settings.ts";
import { runTransaction } from "../../db/transaction.ts";
import { syncScreenshotReferences } from "../media/screenshots.ts";

import type { CampaignRole, Campaign } from "../../domain/types.ts";
export type { CampaignRole, Campaign } from "../../domain/types.ts";
type CampaignRow = {
  id: string;
  ownerId: string;
  name: string;
  notes: string;
  archived: number;
  revision: number;
  createdAt: number;
  updatedAt: number;
  role: CampaignRole;
};

export function createCampaignRepository(database: DatabaseSync) {
  return {
    create(ownerId: string, input: { name: string; notes?: string }): Campaign {
      const id = crypto.randomUUID();
      const now = Date.now();
      runTransaction(database, () => {
        database
          .prepare(
            `INSERT INTO campaigns
            (id, owner_id, name, notes, archived, revision, created_at, updated_at)
           VALUES (?, ?, ?, ?, 0, 1, ?, ?)`,
          )
          .run(
            id,
            ownerId,
            input.name.trim() || "New campaign",
            sanitizeRichText(input.notes ?? ""),
            now,
            now,
          );
        syncScreenshotReferences(
          database,
          id,
          ownerId,
          "campaign",
          id,
          sanitizeRichText(input.notes ?? ""),
        );
        writeAudit(database, {
          campaignId: id,
          actorUserId: ownerId,
          resourceType: "campaign",
          resourceId: id,
          action: "created",
        });
      });
      return getRequired(database, id, ownerId);
    },

    list(userId: string, options: { archived?: boolean } = {}): Campaign[] {
      const rows = database
        .prepare(
          `SELECT c.id, c.owner_id AS ownerId, c.name, c.notes, c.archived,
                  c.revision, c.created_at AS createdAt, c.updated_at AS updatedAt,
                  CASE WHEN c.owner_id = ? THEN 'owner' ELSE m.role END AS role
             FROM campaigns c
             LEFT JOIN campaign_members m
               ON m.campaign_id = c.id AND m.user_id = ?
            WHERE (c.owner_id = ? OR m.user_id = ?)
              AND c.archived = ?
            ORDER BY c.updated_at DESC`,
        )
        .all(
          userId,
          userId,
          userId,
          userId,
          options.archived ? 1 : 0,
        ) as CampaignRow[];
      return rows.map(toCampaign);
    },

    get(id: string, userId: string): Campaign | null {
      return get(database, id, userId);
    },

    update(
      id: string,
      actorUserId: string,
      expectedRevision: number,
      patch: { name?: string; notes?: string; archived?: boolean },
    ): Campaign {
      const current = get(database, id, actorUserId);
      if (!current) throw new ResourceNotFoundError("campaign", id);
      if (current.role === "viewer")
        throw new ResourceNotFoundError("campaign", id);

      const nextName =
        patch.name === undefined
          ? current.name
          : patch.name.trim() || "Campaign";
      const nextNotes = patch.notes ?? current.notes;
      const nextArchived = patch.archived ?? current.archived;
      const now = Date.now();
      runTransaction(database, () => {
        const result = database
          .prepare(
            `UPDATE campaigns
              SET name = ?, notes = ?, archived = ?, revision = revision + 1,
                  updated_at = ?
            WHERE id = ? AND revision = ?`,
          )
          .run(
            nextName,
            nextNotes,
            nextArchived ? 1 : 0,
            now,
            id,
            expectedRevision,
          );
        if (result.changes !== 1) {
          const actual = database
            .prepare("SELECT revision FROM campaigns WHERE id = ?")
            .get(id) as { revision: number } | undefined;
          throw new RevisionConflictError(
            "campaign",
            id,
            expectedRevision,
            actual?.revision ?? null,
          );
        }
        syncScreenshotReferences(
          database,
          id,
          actorUserId,
          "campaign",
          id,
          nextNotes,
        );
        writeAudit(database, {
          campaignId: id,
          actorUserId,
          resourceType: "campaign",
          resourceId: id,
          action:
            nextArchived !== current.archived
              ? nextArchived
                ? "archived"
                : "restored"
              : "updated",
        });
      });
      return getRequired(database, id, actorUserId);
    },

    delete(id: string, actorUserId: string): void {
      const campaign = get(database, id, actorUserId);
      if (!campaign) throw new ResourceNotFoundError("campaign", id);
      if (campaign.role !== "owner")
        throw new PublicApiError("Only the campaign owner can delete it.", 403);
      database
        .prepare("DELETE FROM campaigns WHERE id = ? AND owner_id = ?")
        .run(id, actorUserId);
    },
  };
}

function get(
  database: DatabaseSync,
  id: string,
  userId: string,
): Campaign | null {
  const row = database
    .prepare(
      `SELECT c.id, c.owner_id AS ownerId, c.name, c.notes, c.archived,
              c.revision, c.created_at AS createdAt, c.updated_at AS updatedAt,
              CASE WHEN c.owner_id = ? THEN 'owner' ELSE m.role END AS role
         FROM campaigns c
         LEFT JOIN campaign_members m
           ON m.campaign_id = c.id AND m.user_id = ?
        WHERE c.id = ? AND (c.owner_id = ? OR m.user_id = ?)
        LIMIT 1`,
    )
    .get(userId, userId, id, userId, userId) as CampaignRow | undefined;
  return row ? toCampaign(row) : null;
}

function getRequired(
  database: DatabaseSync,
  id: string,
  userId: string,
): Campaign {
  const campaign = get(database, id, userId);
  if (!campaign) throw new ResourceNotFoundError("campaign", id);
  return campaign;
}

function toCampaign(row: CampaignRow): Campaign {
  return {
    ...row,
    archived: Boolean(row.archived),
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString(),
  };
}

function writeAudit(
  database: DatabaseSync,
  event: {
    campaignId: string;
    actorUserId: string;
    resourceType: string;
    resourceId: string;
    action: string;
  },
): void {
  database
    .prepare(
      `INSERT INTO audit_events
        (campaign_id, actor_user_id, resource_type, resource_id, action, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(
      event.campaignId,
      event.actorUserId,
      event.resourceType,
      event.resourceId,
      event.action,
      Date.now(),
    );
  const limit = getServerSettings(database).auditEventLimit;
  const cutoff = database
    .prepare(
      "SELECT id FROM audit_events WHERE campaign_id = ? ORDER BY id DESC LIMIT 1 OFFSET ?",
    )
    .get(event.campaignId, limit) as { id: number } | undefined;
  if (cutoff)
    database
      .prepare("DELETE FROM audit_events WHERE campaign_id = ? AND id <= ?")
      .run(event.campaignId, cutoff.id);
}
