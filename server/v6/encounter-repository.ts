import { sanitizeRichText } from "../security/sanitize-rich-text.ts";
import { preparedCombatantSchema, preparedEncounterSchema } from "./schemas.ts";
import type { DatabaseSync } from "node:sqlite";
import { runTransaction } from "../../db/transaction.ts";
import { requireCampaignEdit, requireCampaignRead } from "./access.ts";
import { recordAuditEvent } from "./audit.ts";
import { ResourceNotFoundError, RevisionConflictError } from "./conflicts.ts";
import { getV6ServerSettings } from "./server-settings.ts";
import { PublicApiError } from "./errors.ts";
import { syncV6ScreenshotReferences } from "./screenshots.ts";

import type {
  PreparedMonster,
  PreparedCombatant,
  V6PreparedEncounter,
  V6CombatCondition,
  V6Combatant,
  V6CombatEncounter,
} from "../../features/encounters/types.ts";
export type {
  PreparedMonster,
  V6PreparedEncounter,
  V6CombatCondition,
  V6Combatant,
  V6CombatEncounter,
} from "../../features/encounters/types.ts";

type PreparedRow = Omit<
  V6PreparedEncounter,
  "monsters" | "combatants" | "createdAt" | "updatedAt"
> & {
  createdAt: number;
  updatedAt: number;
  combatants: string;
};
type CombatRow = Omit<
  V6CombatEncounter,
  "combatants" | "createdAt" | "updatedAt"
> & {
  createdAt: number;
  updatedAt: number;
};

export function createEncounterRepository(database: DatabaseSync) {
  return {
    listPrepared(
      campaignId: string,
      actorUserId: string,
      sessionId: string,
    ): V6PreparedEncounter[] {
      requireCampaignRead(database, campaignId, actorUserId);
      ensureSession(database, campaignId, sessionId);
      const rows = database
        .prepare(
          `SELECT id, session_id AS sessionId, name, notes, sort_order AS sortOrder,
                revision, created_at AS createdAt, updated_at AS updatedAt, combatants
           FROM prepared_encounters WHERE session_id = ? ORDER BY sort_order, id`,
        )
        .all(sessionId) as PreparedRow[];
      const allMonsters = database
        .prepare(
          `SELECT m.id, m.encounter_id AS encounterId, m.monster_id AS monsterId,
        m.display_number AS displayNumber, m.quantity, m.sort_order AS sortOrder
        FROM prepared_encounter_monsters m JOIN prepared_encounters e ON e.id = m.encounter_id
        WHERE e.session_id = ? ORDER BY m.sort_order, m.id`,
        )
        .all(sessionId) as Array<PreparedMonster & { encounterId: string }>;
      const grouped = new Map<string, PreparedMonster[]>();
      for (const { encounterId, ...monster } of allMonsters) {
        const group = grouped.get(encounterId) ?? [];
        group.push(monster);
        grouped.set(encounterId, group);
      }
      return rows.map((row) =>
        preparedFromRow(database, row, grouped.get(row.id) ?? []),
      );
    },

    createPrepared(
      campaignId: string,
      actorUserId: string,
      sessionId: string,
      input: Pick<
        V6PreparedEncounter,
        "name" | "notes" | "sortOrder" | "monsters" | "combatants"
      >,
    ): V6PreparedEncounter {
      requireCampaignEdit(database, campaignId, actorUserId);
      ensureSession(database, campaignId, sessionId);
      const id = crypto.randomUUID();
      const now = Date.now();
      runTransaction(database, () => {
        database
          .prepare(
            `INSERT INTO prepared_encounters
            (id, session_id, name, notes, sort_order, revision, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
          )
          .run(
            id,
            sessionId,
            input.name,
            input.notes,
            input.sortOrder,
            now,
            now,
          );
        const combatants = preparedEncounterSchema.shape.combatants
          .parse(input.combatants ?? [])
          .map((entry) => {
            const value = preparedCombatantSchema.parse(entry);
            return { ...value, notes: sanitizeRichText(value.notes) };
          });
        database
          .prepare("UPDATE prepared_encounters SET combatants = ? WHERE id = ?")
          .run(JSON.stringify(combatants), id);
        replacePreparedMonsters(database, campaignId, id, input.monsters);
        touch(
          database,
          campaignId,
          actorUserId,
          "prepared_encounter",
          id,
          "created",
        );
        syncV6ScreenshotReferences(
          database,
          campaignId,
          actorUserId,
          "prepared_encounter",
          id,
          [input.notes, ...combatants.map(({ notes }) => notes)].join("\n"),
        );
      });
      return getPrepared(database, id);
    },

    updatePrepared(
      campaignId: string,
      actorUserId: string,
      id: string,
      expectedRevision: number,
      input: Pick<
        V6PreparedEncounter,
        "name" | "notes" | "sortOrder" | "monsters" | "combatants"
      >,
    ): V6PreparedEncounter {
      requireCampaignEdit(database, campaignId, actorUserId);
      runTransaction(database, () => {
        const result = database
          .prepare(
            `UPDATE prepared_encounters SET name = ?, notes = ?, sort_order = ?,
             revision = revision + 1, updated_at = ?
           WHERE id = ? AND revision = ? AND session_id IN
             (SELECT id FROM sessions WHERE campaign_id = ?)`,
          )
          .run(
            input.name,
            input.notes,
            input.sortOrder,
            Date.now(),
            id,
            expectedRevision,
            campaignId,
          );
        if (!result.changes)
          conflictOrMissing(
            database,
            "prepared_encounters",
            "prepared encounter",
            id,
            expectedRevision,
          );
        const combatants = preparedEncounterSchema.shape.combatants
          .parse(input.combatants ?? [])
          .map((entry) => {
            const value = preparedCombatantSchema.parse(entry);
            return { ...value, notes: sanitizeRichText(value.notes) };
          });
        database
          .prepare("UPDATE prepared_encounters SET combatants = ? WHERE id = ?")
          .run(JSON.stringify(combatants), id);
        replacePreparedMonsters(database, campaignId, id, input.monsters);
        touch(
          database,
          campaignId,
          actorUserId,
          "prepared_encounter",
          id,
          "updated",
        );
        syncV6ScreenshotReferences(
          database,
          campaignId,
          actorUserId,
          "prepared_encounter",
          id,
          [input.notes, ...combatants.map(({ notes }) => notes)].join("\n"),
        );
      });
      return getPrepared(database, id);
    },

    deletePrepared(campaignId: string, actorUserId: string, id: string): void {
      requireCampaignEdit(database, campaignId, actorUserId);
      runTransaction(database, () => {
        syncV6ScreenshotReferences(
          database,
          campaignId,
          actorUserId,
          "prepared_encounter",
          id,
          "",
        );
        const result = database
          .prepare(
            `DELETE FROM prepared_encounters WHERE id = ? AND session_id IN
            (SELECT id FROM sessions WHERE campaign_id = ?)`,
          )
          .run(id, campaignId);
        if (!result.changes)
          throw new ResourceNotFoundError("prepared encounter", id);
        touch(
          database,
          campaignId,
          actorUserId,
          "prepared_encounter",
          id,
          "deleted",
        );
      });
    },

    getCombat(campaignId: string, actorUserId: string): V6CombatEncounter {
      requireCampaignRead(database, campaignId, actorUserId);
      return getOrCreateCombat(database, campaignId);
    },

    saveCombat(
      campaignId: string,
      actorUserId: string,
      expectedRevision: number,
      input: Pick<V6CombatEncounter, "name" | "round" | "turn" | "combatants">,
      action = "updated",
    ): V6CombatEncounter {
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
        database
          .prepare(
            `INSERT INTO combat_history
            (encounter_id, actor_user_id, action, before_state, created_at)
           VALUES (?, ?, ?, ?, ?)`,
          )
          .run(
            current.id,
            actorUserId,
            action,
            JSON.stringify(current),
            Date.now(),
          );
        pruneCombatHistory(database, current.id);
        const result = database
          .prepare(
            `UPDATE combat_encounters SET name = ?, round = ?, turn = ?,
             revision = revision + 1, updated_at = ?
           WHERE id = ? AND revision = ?`,
          )
          .run(
            input.name,
            input.round,
            input.turn,
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
          );
        replaceCombatants(database, campaignId, current.id, input.combatants);
        touch(database, campaignId, actorUserId, "combat", current.id, action);
        syncV6ScreenshotReferences(
          database,
          campaignId,
          actorUserId,
          "combat",
          current.id,
          ...input.combatants.map(({ notes }) => notes),
        );
      });
      return getCombat(database, current.id);
    },

    undoCombat(campaignId: string, actorUserId: string): V6CombatEncounter {
      requireCampaignEdit(database, campaignId, actorUserId);
      const current = getOrCreateCombat(database, campaignId);
      const history = database
        .prepare(
          `SELECT id, before_state AS beforeState FROM combat_history
          WHERE encounter_id = ? ORDER BY id DESC LIMIT 1`,
        )
        .get(current.id) as { id: number; beforeState: string } | undefined;
      if (!history) return current;
      const previous = JSON.parse(history.beforeState) as V6CombatEncounter;
      runTransaction(database, () => {
        database
          .prepare(
            `UPDATE combat_encounters SET name = ?, round = ?, turn = ?,
             revision = revision + 1, updated_at = ? WHERE id = ?`,
          )
          .run(
            previous.name,
            previous.round,
            previous.turn,
            Date.now(),
            current.id,
          );
        replaceCombatants(
          database,
          campaignId,
          current.id,
          previous.combatants,
        );
        database
          .prepare("DELETE FROM combat_history WHERE id = ?")
          .run(history.id);
        touch(database, campaignId, actorUserId, "combat", current.id, "undo");
        syncV6ScreenshotReferences(
          database,
          campaignId,
          actorUserId,
          "combat",
          current.id,
          ...previous.combatants.map(({ notes }) => notes),
        );
      });
      return getCombat(database, current.id);
    },
  };
}

function pruneCombatHistory(database: DatabaseSync, encounterId: string): void {
  const limit = getV6ServerSettings(database).combatHistoryLimit;
  const cutoff = database
    .prepare(
      "SELECT id FROM combat_history WHERE encounter_id = ? ORDER BY id DESC LIMIT 1 OFFSET ?",
    )
    .get(encounterId, limit) as { id: number } | undefined;
  if (cutoff)
    database
      .prepare("DELETE FROM combat_history WHERE encounter_id = ? AND id <= ?")
      .run(encounterId, cutoff.id);
}

function replacePreparedMonsters(
  database: DatabaseSync,
  campaignId: string,
  encounterId: string,
  monsters: PreparedMonster[],
): void {
  database
    .prepare("DELETE FROM prepared_encounter_monsters WHERE encounter_id = ?")
    .run(encounterId);
  const valid = database.prepare(
    "SELECT id FROM monsters WHERE id = ? AND campaign_id = ? LIMIT 1",
  );
  const insert = database.prepare(
    `INSERT INTO prepared_encounter_monsters
      (id, encounter_id, monster_id, display_number, quantity, sort_order)
     VALUES (?, ?, ?, ?, ?, ?)`,
  );
  for (const entry of monsters) {
    if (!valid.get(entry.monsterId, campaignId))
      throw new ResourceNotFoundError("monster", entry.monsterId);
    insert.run(
      entry.id || crypto.randomUUID(),
      encounterId,
      entry.monsterId,
      entry.displayNumber,
      Math.max(1, entry.quantity),
      entry.sortOrder,
    );
  }
}

function replaceCombatants(
  database: DatabaseSync,
  campaignId: string,
  encounterId: string,
  combatants: V6Combatant[],
): void {
  database
    .prepare("DELETE FROM combatants WHERE encounter_id = ?")
    .run(encounterId);
  const insertCombatant = database.prepare(
    `INSERT INTO combatants
      (id, encounter_id, player_id, monster_id, name, display_number, kind,
       notes, initiative, hit_points, maximum_hit_points, armor_class,
       sort_order, revision, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const insertCondition = database.prepare(
    `INSERT INTO combat_conditions
      (id, combatant_id, name, remaining_turns, created_at) VALUES (?, ?, ?, ?, ?)`,
  );
  const validPlayer = database.prepare(
    "SELECT id FROM players WHERE id = ? AND campaign_id = ? LIMIT 1",
  );
  const validMonster = database.prepare(
    "SELECT id FROM monsters WHERE id = ? AND campaign_id = ? LIMIT 1",
  );
  const now = Date.now();
  for (const combatant of combatants) {
    if (
      combatant.playerId &&
      (!validPlayer.get(combatant.playerId, campaignId) ||
        combatant.kind !== "player" ||
        combatant.monsterId)
    )
      throw new PublicApiError(
        "A linked player combatant must reference a player in this campaign.",
      );
    if (
      combatant.monsterId &&
      (!validMonster.get(combatant.monsterId, campaignId) ||
        combatant.kind !== "monster" ||
        combatant.playerId)
    )
      throw new PublicApiError(
        "A linked monster combatant must reference a monster in this campaign.",
      );
    if (combatant.kind === "npc" && (combatant.playerId || combatant.monsterId))
      throw new PublicApiError(
        "NPC combatants cannot reference campaign players or Bestiary monsters.",
      );
    const combatantId = combatant.id || crypto.randomUUID();
    insertCombatant.run(
      combatantId,
      encounterId,
      combatant.playerId,
      combatant.monsterId,
      combatant.name,
      combatant.displayNumber,
      combatant.kind,
      combatant.notes ?? "",
      combatant.initiative,
      combatant.hitPoints,
      combatant.maximumHitPoints,
      combatant.armorClass,
      combatant.sortOrder,
      combatant.revision || 1,
      now,
      now,
    );
    for (const condition of combatant.conditions) {
      insertCondition.run(
        condition.id || crypto.randomUUID(),
        combatantId,
        condition.name,
        condition.remainingTurns,
        now,
      );
    }
  }
}

function getOrCreateCombat(
  database: DatabaseSync,
  campaignId: string,
): V6CombatEncounter {
  let row = database
    .prepare(
      `SELECT id, campaign_id AS campaignId, name, round, turn, revision,
            created_at AS createdAt, updated_at AS updatedAt
       FROM combat_encounters WHERE campaign_id = ?`,
    )
    .get(campaignId) as CombatRow | undefined;
  if (!row) {
    const now = Date.now();
    const id = crypto.randomUUID();
    database
      .prepare(
        `INSERT INTO combat_encounters
        (id, campaign_id, name, round, turn, revision, created_at, updated_at)
       VALUES (?, ?, 'Encounter', 1, 0, 1, ?, ?)`,
      )
      .run(id, campaignId, now, now);
    row = database
      .prepare(
        `SELECT id, campaign_id AS campaignId, name, round, turn, revision,
              created_at AS createdAt, updated_at AS updatedAt
         FROM combat_encounters WHERE id = ?`,
      )
      .get(id) as CombatRow;
  }
  return combatFromRow(database, row);
}

function getCombat(database: DatabaseSync, id: string): V6CombatEncounter {
  const row = database
    .prepare(
      `SELECT id, campaign_id AS campaignId, name, round, turn, revision,
            created_at AS createdAt, updated_at AS updatedAt
       FROM combat_encounters WHERE id = ?`,
    )
    .get(id) as CombatRow | undefined;
  if (!row) throw new ResourceNotFoundError("combat", id);
  return combatFromRow(database, row);
}

function combatFromRow(
  database: DatabaseSync,
  row: CombatRow,
): V6CombatEncounter {
  const combatants = database
    .prepare(
      `SELECT id, player_id AS playerId, monster_id AS monsterId, name,
            display_number AS displayNumber, kind, notes, initiative,
            hit_points AS hitPoints, maximum_hit_points AS maximumHitPoints,
            armor_class AS armorClass, sort_order AS sortOrder, revision
       FROM combatants WHERE encounter_id = ? ORDER BY sort_order, id`,
    )
    .all(row.id) as Array<Omit<V6Combatant, "conditions">>;
  const conditions = database.prepare(
    `SELECT id, name, remaining_turns AS remainingTurns
       FROM combat_conditions WHERE combatant_id = ? ORDER BY created_at, id`,
  );
  return {
    ...row,
    combatants: combatants.map((combatant) => ({
      ...combatant,
      conditions: conditions.all(combatant.id) as V6CombatCondition[],
    })),
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString(),
  };
}

function getPrepared(database: DatabaseSync, id: string): V6PreparedEncounter {
  const row = database
    .prepare(
      `SELECT id, session_id AS sessionId, name, notes, sort_order AS sortOrder,
            revision, created_at AS createdAt, updated_at AS updatedAt, combatants
       FROM prepared_encounters WHERE id = ?`,
    )
    .get(id) as PreparedRow | undefined;
  if (!row) throw new ResourceNotFoundError("prepared encounter", id);
  return preparedFromRow(database, row);
}

function preparedFromRow(
  database: DatabaseSync,
  row: PreparedRow,
  suppliedMonsters?: PreparedMonster[],
): V6PreparedEncounter {
  const monsters =
    suppliedMonsters ??
    (database
      .prepare(
        `SELECT id, monster_id AS monsterId, display_number AS displayNumber,
            quantity, sort_order AS sortOrder
       FROM prepared_encounter_monsters WHERE encounter_id = ?
      ORDER BY sort_order, id`,
      )
      .all(row.id) as PreparedMonster[]);
  return {
    ...row,
    monsters,
    combatants: JSON.parse(row.combatants) as PreparedCombatant[],
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString(),
  };
}

function ensureSession(
  database: DatabaseSync,
  campaignId: string,
  sessionId: string,
): void {
  if (
    !database
      .prepare(
        "SELECT id FROM sessions WHERE id = ? AND campaign_id = ? LIMIT 1",
      )
      .get(sessionId, campaignId)
  )
    throw new ResourceNotFoundError("session", sessionId);
}

function conflictOrMissing(
  database: DatabaseSync,
  table: "prepared_encounters" | "combat_encounters",
  type: string,
  id: string,
  expectedRevision: number,
): never {
  const row = database
    .prepare(`SELECT revision FROM ${table} WHERE id = ?`)
    .get(id) as { revision: number } | undefined;
  if (!row) throw new ResourceNotFoundError(type, id);
  throw new RevisionConflictError(type, id, expectedRevision, row.revision);
}

function touch(
  database: DatabaseSync,
  campaignId: string,
  actorUserId: string,
  resourceType: string,
  resourceId: string,
  action: string,
): void {
  database
    .prepare(
      "UPDATE campaigns SET revision = revision + 1, updated_at = ? WHERE id = ?",
    )
    .run(Date.now(), campaignId);
  recordAuditEvent(database, {
    campaignId,
    actorUserId,
    resourceType,
    resourceId,
    action,
  });
}
