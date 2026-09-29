import type { DatabaseSync } from "node:sqlite";
import { RevisionConflictError, ResourceNotFoundError } from "./conflicts.ts";
import { PublicApiError } from "./errors.ts";

export type V6CampaignRole = "owner" | "editor" | "viewer";

export type V6Campaign = {
  id: string;
  ownerId: string;
  name: string;
  notes: string;
  archived: boolean;
  revision: number;
  createdAt: string;
  updatedAt: string;
  role: V6CampaignRole;
};

type CampaignRow = {
  id: string;
  ownerId: string;
  name: string;
  notes: string;
  archived: number;
  revision: number;
  createdAt: number;
  updatedAt: number;
  role: V6CampaignRole;
};

export function createV6CampaignRepository(database: DatabaseSync) {
  return {
    create(ownerId: string, input: { name: string; notes?: string }): V6Campaign {
      const id = crypto.randomUUID();
      const now = Date.now();
      database
        .prepare(
          `INSERT INTO campaigns
            (id, owner_id, name, notes, archived, revision, created_at, updated_at)
           VALUES (?, ?, ?, ?, 0, 1, ?, ?)`,
        )
        .run(id, ownerId, input.name.trim() || "New campaign", input.notes ?? "", now, now);
      writeAudit(database, {
        campaignId: id,
        actorUserId: ownerId,
        resourceType: "campaign",
        resourceId: id,
        action: "created",
      });
      return getRequired(database, id, ownerId);
    },

    list(userId: string, options: { archived?: boolean } = {}): V6Campaign[] {
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
        .all(userId, userId, userId, userId, options.archived ? 1 : 0) as CampaignRow[];
      return rows.map(toCampaign);
    },

    get(id: string, userId: string): V6Campaign | null {
      return get(database, id, userId);
    },

    update(
      id: string,
      actorUserId: string,
      expectedRevision: number,
      patch: { name?: string; notes?: string; archived?: boolean },
    ): V6Campaign {
      const current = get(database, id, actorUserId);
      if (!current) throw new ResourceNotFoundError("campaign", id);
      if (current.role === "viewer")
        throw new ResourceNotFoundError("campaign", id);

      const nextName = patch.name === undefined
        ? current.name
        : patch.name.trim() || "Campaign";
      const nextNotes = patch.notes ?? current.notes;
      const nextArchived = patch.archived ?? current.archived;
      const now = Date.now();
      const result = database
        .prepare(
          `UPDATE campaigns
              SET name = ?, notes = ?, archived = ?, revision = revision + 1,
                  updated_at = ?
            WHERE id = ? AND revision = ?`,
        )
        .run(nextName, nextNotes, nextArchived ? 1 : 0, now, id, expectedRevision);
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
      writeAudit(database, {
        campaignId: id,
        actorUserId,
        resourceType: "campaign",
        resourceId: id,
        action: nextArchived !== current.archived
          ? nextArchived ? "archived" : "restored"
          : "updated",
      });
      return getRequired(database, id, actorUserId);
    },

    delete(id: string, actorUserId: string): void {
      const campaign = get(database, id, actorUserId);
      if (!campaign) throw new ResourceNotFoundError("campaign", id);
      if (campaign.role !== "owner") throw new PublicApiError("Only the campaign owner can delete it.", 403);
      database.prepare("DELETE FROM campaigns WHERE id = ? AND owner_id = ?").run(id, actorUserId);
    },
  };
}

function get(database: DatabaseSync, id: string, userId: string): V6Campaign | null {
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

function getRequired(database: DatabaseSync, id: string, userId: string): V6Campaign {
  const campaign = get(database, id, userId);
  if (!campaign) throw new ResourceNotFoundError("campaign", id);
  return campaign;
}

function toCampaign(row: CampaignRow): V6Campaign {
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
  const configured = Number(process.env.DM_COMMAND_TABLE_AUDIT_EVENT_LIMIT);
  const limit = Number.isInteger(configured) && configured >= 100
    ? Math.min(configured, 100_000)
    : 10_000;
  const cutoff = database.prepare(
    "SELECT id FROM audit_events WHERE campaign_id = ? ORDER BY id DESC LIMIT 1 OFFSET ?",
  ).get(event.campaignId, limit) as { id: number } | undefined;
  if (cutoff)
    database.prepare("DELETE FROM audit_events WHERE campaign_id = ? AND id <= ?").run(event.campaignId, cutoff.id);
}
