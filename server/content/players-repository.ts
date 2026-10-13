import { statement } from "../../db/statements.ts";
import { sanitizeRichText } from "../security/sanitize-rich-text.ts";
import type { DatabaseSync } from "node:sqlite";
import { runTransaction } from "../../db/transaction.ts";
import {
  requireCampaignEdit,
  requireCampaignRead,
} from "../campaigns/access.ts";
import { ResourceNotFoundError } from "../http/conflicts.ts";
import { syncScreenshotReferences } from "../media/screenshots.ts";
import type { Player } from "../../domain/types.ts";
import {
  index,
  removeIndex,
  assertUpdated,
  changed,
  withTimestamps,
} from "./persistence.ts";
type PlayerRow = Omit<Player, "createdAt" | "updatedAt"> & {
  createdAt: number;
  updatedAt: number;
};
export function createPlayerRepository(database: DatabaseSync) {
  return {
    listPlayers(campaignId: string, actorUserId: string): Player[] {
      requireCampaignRead(database, campaignId, actorUserId);
      return (
        statement(
          database,
          `SELECT id, campaign_id AS campaignId, name, kind, race, class_name AS className,
                level, hit_points AS hitPoints, armor_class AS armorClass, notes,
                revision, created_at AS createdAt, updated_at AS updatedAt
           FROM players WHERE campaign_id = ? ORDER BY name COLLATE NOCASE, id`,
        ).all(campaignId) as PlayerRow[]
      ).map(toPlayer);
    },
    createPlayer(
      campaignId: string,
      actorUserId: string,
      input: Omit<
        Player,
        "id" | "campaignId" | "revision" | "createdAt" | "updatedAt" | "kind"
      > & { kind?: Player["kind"] },
    ): Player {
      requireCampaignEdit(database, campaignId, actorUserId);
      const id = crypto.randomUUID();
      const now = Date.now();
      runTransaction(database, () => {
        statement(
          database,
          `INSERT INTO players
          (id, campaign_id, kind, name, race, class_name, level, hit_points,
           armor_class, notes, revision, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
        ).run(
          id,
          campaignId,
          input.kind ?? "player",
          input.name,
          input.race,
          input.className,
          input.level,
          input.hitPoints,
          input.armorClass,
          sanitizeRichText(input.notes ?? ""),
          now,
          now,
        );
        changed(database, campaignId, actorUserId, "player", id, "created");
        index(
          database,
          campaignId,
          "player",
          id,
          input.name,
          `${input.race} ${input.className} ${input.notes}`,
        );
        syncScreenshotReferences(
          database,
          campaignId,
          actorUserId,
          "player",
          id,
          sanitizeRichText(input.notes ?? ""),
        );
      });
      return getPlayer(database, id);
    },
    updatePlayer(
      campaignId: string,
      actorUserId: string,
      id: string,
      expectedRevision: number,
      input: Omit<
        Player,
        "id" | "campaignId" | "revision" | "createdAt" | "updatedAt" | "kind"
      > & { kind?: Player["kind"] },
    ): Player {
      requireCampaignEdit(database, campaignId, actorUserId);
      runTransaction(database, () => {
        const result = statement(
          database,
          `UPDATE players SET kind = ?, name = ?, race = ?, class_name = ?, level = ?,
           hit_points = ?, armor_class = ?, notes = ?, revision = revision + 1,
           updated_at = ?
         WHERE id = ? AND campaign_id = ? AND revision = ?`,
        ).run(
          input.kind ?? "player",
          input.name,
          input.race,
          input.className,
          input.level,
          input.hitPoints,
          input.armorClass,
          sanitizeRichText(input.notes ?? ""),
          Date.now(),
          id,
          campaignId,
          expectedRevision,
        );
        assertUpdated(
          database,
          "players",
          "player",
          id,
          expectedRevision,
          result.changes,
        );
        changed(database, campaignId, actorUserId, "player", id, "updated");
        index(
          database,
          campaignId,
          "player",
          id,
          input.name,
          `${input.race} ${input.className} ${input.notes}`,
        );
        syncScreenshotReferences(
          database,
          campaignId,
          actorUserId,
          "player",
          id,
          sanitizeRichText(input.notes ?? ""),
        );
      });
      return getPlayer(database, id);
    },
    deletePlayer(campaignId: string, actorUserId: string, id: string): void {
      requireCampaignEdit(database, campaignId, actorUserId);
      runTransaction(database, () => {
        syncScreenshotReferences(
          database,
          campaignId,
          actorUserId,
          "player",
          id,
          "",
        );
        const result = statement(
          database,
          "DELETE FROM players WHERE id = ? AND campaign_id = ?",
        ).run(id, campaignId);
        if (!result.changes) throw new ResourceNotFoundError("player", id);
        removeIndex(database, campaignId, "player", id);
        changed(database, campaignId, actorUserId, "player", id, "deleted");
      });
    },
  };
}
function getPlayer(database: DatabaseSync, id: string): Player {
  const row = statement(
    database,
    `SELECT id, campaign_id AS campaignId, name, kind, race, class_name AS className,
            level, hit_points AS hitPoints, armor_class AS armorClass, notes,
            revision, created_at AS createdAt, updated_at AS updatedAt
       FROM players WHERE id = ?`,
  ).get(id) as PlayerRow | undefined;
  if (!row) throw new ResourceNotFoundError("player", id);
  return toPlayer(row);
}

function toPlayer(row: PlayerRow): Player {
  return withTimestamps(row);
}
