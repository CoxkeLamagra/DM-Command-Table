import { statement } from "../../db/statements.ts";
import { combatRichText, emptyRuntime } from "../../domain/combat-runtime.ts";
import { orderedCombatants } from "../../domain/combat.ts";
import type { DatabaseSync } from "node:sqlite";
import { runTransaction } from "../../db/transaction.ts";
import {
  requireCampaignEdit,
  requireCampaignRead,
} from "../campaigns/access.ts";
import { RevisionConflictError } from "../http/conflicts.ts";
import { syncScreenshotReferences } from "../media/screenshots.ts";
import type { CombatEncounter } from "../../domain/encounters.ts";
import { conflictOrMissing, touch } from "./persistence.ts";
import {
  pruneCombatHistory,
  replaceCombatants,
  getOrCreateCombat,
  getCombat,
} from "./combat-storage.ts";
export function createCombatRepository(database: DatabaseSync) {
  return {
    getCombat(campaignId: string, actorUserId: string): CombatEncounter {
      requireCampaignRead(database, campaignId, actorUserId);
      return getOrCreateCombat(database, campaignId);
    },

    saveCombat(
      campaignId: string,
      actorUserId: string,
      expectedRevision: number,
      input: Pick<CombatEncounter, "name" | "round" | "turn" | "combatants">,
      action = "updated",
    ): CombatEncounter {
      requireCampaignEdit(database, campaignId, actorUserId);
      const current = getOrCreateCombat(database, campaignId);
      if (current.revision !== expectedRevision)
        throw new RevisionConflictError(
          "combat",
          current.id,
          expectedRevision,
          current.revision,
        );
      runTransaction(database, () => {
        const historyInsert = statement(
          database,
          `INSERT INTO combat_history
            (encounter_id, actor_user_id, action, before_state, created_at)
           VALUES (?, ?, ?, ?, ?)`,
        ).run(
          current.id,
          actorUserId,
          action,
          JSON.stringify(current),
          Date.now(),
        );
        syncScreenshotReferences(
          database,
          campaignId,
          actorUserId,
          "combat_history",
          String(historyInsert.lastInsertRowid),
          ...current.combatants.flatMap(combatRichText),
        );
        pruneCombatHistory(database, current.id);
        const result = statement(
          database,
          `UPDATE combat_encounters SET name = ?, round = ?, turn = ?, active_combatant_id = ?,
             revision = revision + 1, updated_at = ?
           WHERE id = ? AND revision = ?`,
        ).run(
          input.name,
          input.round,
          input.turn,
          orderedCombatants(input.combatants)[input.turn]?.id ?? null,
          Date.now(),
          current.id,
          expectedRevision,
        );
        if (!result.changes)
          conflictOrMissing(
            database,
            "combat_encounters",
            "combat",
            current.id,
            expectedRevision,
            campaignId,
          );
        replaceCombatants(database, campaignId, current.id, input.combatants);
        touch(database, campaignId, actorUserId, "combat", current.id, action);
        syncScreenshotReferences(
          database,
          campaignId,
          actorUserId,
          "combat",
          current.id,
          ...getCombat(database, current.id).combatants.flatMap(combatRichText),
        );
      });
      return getCombat(database, current.id);
    },

    undoCombat(
      campaignId: string,
      actorUserId: string,
      expectedRevision?: number,
    ): CombatEncounter {
      requireCampaignEdit(database, campaignId, actorUserId);
      const current = getOrCreateCombat(database, campaignId);
      if (
        expectedRevision !== undefined &&
        current.revision !== expectedRevision
      )
        throw new RevisionConflictError(
          "combat",
          current.id,
          expectedRevision,
          current.revision,
        );
      const history = statement(
        database,
        `SELECT id, before_state AS beforeState FROM combat_history
          WHERE encounter_id = ? ORDER BY id DESC LIMIT 1`,
      ).get(current.id) as { id: number; beforeState: string } | undefined;
      if (!history) return current;
      const previous = JSON.parse(history.beforeState) as CombatEncounter;
      const players = new Set(
        (
          statement(database, "SELECT id FROM players WHERE campaign_id=?").all(
            campaignId,
          ) as Array<{ id: string }>
        ).map((value) => value.id),
      );
      const monsters = new Set(
        (
          statement(
            database,
            "SELECT id FROM monsters WHERE campaign_id=?",
          ).all(campaignId) as Array<{ id: string }>
        ).map((value) => value.id),
      );
      previous.combatants = previous.combatants.map((entry) => ({
        ...entry,
        playerId:
          entry.playerId && players.has(entry.playerId) ? entry.playerId : null,
        monsterId:
          entry.monsterId && monsters.has(entry.monsterId)
            ? entry.monsterId
            : null,
        runtime: entry.runtime ?? emptyRuntime(),
      }));
      runTransaction(database, () => {
        const updated = statement(
          database,
          `UPDATE combat_encounters SET name = ?, round = ?, turn = ?, active_combatant_id = ?,
             revision = revision + 1, updated_at = ? WHERE id = ? AND revision = ?`,
        ).run(
          previous.name,
          previous.round,
          previous.turn,
          orderedCombatants(previous.combatants)[previous.turn]?.id ?? null,
          Date.now(),
          current.id,
          current.revision,
        );
        if (updated.changes !== 1)
          throw new RevisionConflictError(
            "combat",
            current.id,
            current.revision,
            getOrCreateCombat(database, campaignId).revision,
          );
        replaceCombatants(
          database,
          campaignId,
          current.id,
          previous.combatants,
        );
        statement(database, "DELETE FROM combat_history WHERE id = ?").run(
          history.id,
        );
        touch(database, campaignId, actorUserId, "combat", current.id, "undo");
        syncScreenshotReferences(
          database,
          campaignId,
          actorUserId,
          "combat",
          current.id,
          ...getCombat(database, current.id).combatants.flatMap(combatRichText),
        );
        statement(
          database,
          "DELETE FROM screenshot_references WHERE resource_type='combat_history' AND resource_id=?",
        ).run(String(history.id));
      });
      return getCombat(database, current.id);
    },
  };
}
