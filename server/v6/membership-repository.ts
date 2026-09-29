import type { DatabaseSync } from "node:sqlite";
import { runTransaction } from "../../db/transaction.ts";
import { requireCampaignOwner } from "./access.ts";
import { recordAuditEvent } from "./audit.ts";
import { ResourceNotFoundError } from "./conflicts.ts";

export type CampaignMember = {
  userId: string;
  username: string;
  displayName: string;
  role: "owner" | "editor" | "viewer";
  updatedAt: string;
};

type MemberRow = Omit<CampaignMember, "updatedAt"> & { updatedAt: number };

export function createMembershipRepository(database: DatabaseSync) {
  return {
    list(campaignId: string, actorUserId: string): CampaignMember[] {
      requireCampaignOwner(database, campaignId, actorUserId);
      const rows = database
        .prepare(
          `SELECT u.id AS userId, u.username, u.display_name AS displayName,
                  CASE WHEN c.owner_id = u.id THEN 'owner' ELSE m.role END AS role,
                  CASE WHEN c.owner_id = u.id THEN c.updated_at ELSE m.updated_at END AS updatedAt
             FROM campaigns c
             JOIN users u ON u.id = c.owner_id
             LEFT JOIN campaign_members m ON 0
            WHERE c.id = ?
           UNION ALL
           SELECT u.id, u.username, u.display_name, m.role, m.updated_at
             FROM campaign_members m
             JOIN users u ON u.id = m.user_id
            WHERE m.campaign_id = ?`,
        )
        .all(campaignId, campaignId) as MemberRow[];
      const rank = { owner: 0, editor: 1, viewer: 2 } as const;
      return rows
        .map(toMember)
        .sort((left, right) =>
          rank[left.role] - rank[right.role] || left.username.localeCompare(right.username),
        );
    },

    grant(
      campaignId: string,
      actorUserId: string,
      username: string,
      role: "viewer" | "editor",
    ): CampaignMember[] {
      requireCampaignOwner(database, campaignId, actorUserId);
      const target = database
        .prepare(
          "SELECT id, username FROM users WHERE username = ? COLLATE NOCASE LIMIT 1",
        )
        .get(username.trim()) as { id: string; username: string } | undefined;
      if (!target) throw new ResourceNotFoundError("user", username);
      const owner = database
        .prepare("SELECT owner_id AS ownerId FROM campaigns WHERE id = ?")
        .get(campaignId) as { ownerId: string };
      if (target.id === owner.ownerId)
        throw new Error("The campaign owner already has full access.");
      const now = Date.now();
      database
        .prepare(
          `INSERT INTO campaign_members
            (campaign_id, user_id, role, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(campaign_id, user_id)
           DO UPDATE SET role = excluded.role, updated_at = excluded.updated_at`,
        )
        .run(campaignId, target.id, role, now, now);
      recordAuditEvent(database, {
        campaignId,
        actorUserId,
        resourceType: "campaign_member",
        resourceId: target.id,
        action: "access_granted",
        details: { role },
      });
      return this.list(campaignId, actorUserId);
    },

    revoke(campaignId: string, actorUserId: string, userId: string): CampaignMember[] {
      requireCampaignOwner(database, campaignId, actorUserId);
      database
        .prepare("DELETE FROM campaign_members WHERE campaign_id = ? AND user_id = ?")
        .run(campaignId, userId);
      recordAuditEvent(database, {
        campaignId,
        actorUserId,
        resourceType: "campaign_member",
        resourceId: userId,
        action: "access_revoked",
      });
      return this.list(campaignId, actorUserId);
    },

    transferOwnership(
      campaignId: string,
      actorUserId: string,
      newOwnerId: string,
    ): CampaignMember[] {
      requireCampaignOwner(database, campaignId, actorUserId);
      const target = database
        .prepare(
          "SELECT role FROM campaign_members WHERE campaign_id = ? AND user_id = ?",
        )
        .get(campaignId, newOwnerId) as { role: string } | undefined;
      if (!target)
        throw new ResourceNotFoundError("campaign member", newOwnerId);
      runTransaction(database, () => {
        const now = Date.now();
        database.prepare(
          `INSERT INTO campaign_members
            (campaign_id, user_id, role, created_at, updated_at)
           VALUES (?, ?, 'editor', ?, ?)`,
        ).run(campaignId, actorUserId, now, now);
        database.prepare(
          "DELETE FROM campaign_members WHERE campaign_id = ? AND user_id = ?",
        ).run(campaignId, newOwnerId);
        database.prepare(
          "UPDATE campaigns SET owner_id = ?, revision = revision + 1, updated_at = ? WHERE id = ?",
        ).run(newOwnerId, now, campaignId);
        recordAuditEvent(database, {
          campaignId,
          actorUserId,
          resourceType: "campaign",
          resourceId: campaignId,
          action: "ownership_transferred",
          details: { newOwnerId },
        });
      });
      return this.list(campaignId, newOwnerId);
    },
  };
}

function toMember(row: MemberRow): CampaignMember {
  return { ...row, updatedAt: new Date(row.updatedAt).toISOString() };
}
