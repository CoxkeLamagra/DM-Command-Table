import type { DatabaseSync } from "node:sqlite";
import type { V6CampaignRole } from "./campaign-repository.ts";

export class AuthorizationError extends Error {
  constructor(message = "You do not have permission to perform this action.") {
    super(message);
    this.name = "AuthorizationError";
  }
}

export function campaignRole(
  database: DatabaseSync,
  campaignId: string,
  userId: string,
): V6CampaignRole | null {
  const row = database
    .prepare(
      `SELECT CASE WHEN c.owner_id = ? THEN 'owner' ELSE m.role END AS role
         FROM campaigns c
         LEFT JOIN campaign_members m
           ON m.campaign_id = c.id AND m.user_id = ?
        WHERE c.id = ? AND (c.owner_id = ? OR m.user_id = ?)
        LIMIT 1`,
    )
    .get(userId, userId, campaignId, userId, userId) as
    | { role: V6CampaignRole }
    | undefined;
  return row?.role ?? null;
}

export function requireCampaignRead(
  database: DatabaseSync,
  campaignId: string,
  userId: string,
): V6CampaignRole {
  const role = campaignRole(database, campaignId, userId);
  if (!role) throw new AuthorizationError("Campaign access is required.");
  return role;
}

export function requireCampaignEdit(
  database: DatabaseSync,
  campaignId: string,
  userId: string,
): "owner" | "editor" {
  const role = campaignRole(database, campaignId, userId);
  if (role !== "owner" && role !== "editor")
    throw new AuthorizationError("Campaign editor access is required.");
  return role;
}

export function requireCampaignOwner(
  database: DatabaseSync,
  campaignId: string,
  userId: string,
): void {
  if (campaignRole(database, campaignId, userId) !== "owner")
    throw new AuthorizationError("Campaign owner access is required.");
}

