import type { DatabaseSync } from "node:sqlite";
import { runTransaction } from "../../db/transaction.ts";
import { requireCampaignEdit, requireCampaignRead } from "./access.ts";
import { recordAuditEvent } from "./audit.ts";
import { ResourceNotFoundError, RevisionConflictError } from "./conflicts.ts";
import { getV6ServerSettings } from "./server-settings.ts";

export type PreparedMonster = {
  id: string;
  monsterId: string;
  displayNumber: number | null;
  quantity: number;
  sortOrder: number;
};

export type V6PreparedEncounter = {
  id: string;
  sessionId: string;
  name: string;
  notes: string;
  sortOrder: number;
  monsters: PreparedMonster[];
  revision: number;
  createdAt: string;
  updatedAt: string;
};

export type V6CombatCondition = {
  id: string;
  name: string;
  remainingTurns: number | null;
};

export type V6Combatant = {
  id: string;
  playerId: string | null;
  monsterId: string | null;
  name: string;
  displayNumber: number | null;
  kind: "player" | "monster" | "npc";
  notes: string;
  initiative: number;
  hitPoints: number;
  maximumHitPoints: number;
  armorClass: number;
  sortOrder: number;
  conditions: V6CombatCondition[];
  revision: number;
};

export type V6CombatEncounter = {
  id: string;
  campaignId: string;
  name: string;
  round: number;
  turn: number;
  combatants: V6Combatant[];
  revision: number;
  createdAt: string;
  updatedAt: string;
};

type PreparedRow = Omit<V6PreparedEncounter, "monsters" | "createdAt" | "updatedAt"> & {
  createdAt: number;
  updatedAt: number;
};
type CombatRow = Omit<V6CombatEncounter, "combatants" | "createdAt" | "updatedAt"> & {
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
      const rows = database.prepare(
        `SELECT id, session_id AS sessionId, name, notes, sort_order AS sortOrder,
                revision, created_at AS createdAt, updated_at AS updatedAt
           FROM prepared_encounters WHERE session_id = ? ORDER BY sort_order, id`,
      ).all(sessionId) as PreparedRow[];
      return rows.map((row) => preparedFromRow(database, row));
    },

    createPrepared(
      campaignId: string,
      actorUserId: string,
      sessionId: string,
      input: Pick<V6PreparedEncounter, "name" | "notes" | "sortOrder" | "monsters">,
    ): V6PreparedEncounter {
      requireCampaignEdit(database, campaignId, actorUserId);
      ensureSession(database, campaignId, sessionId);
      const id = crypto.randomUUID();
      const now = Date.now();
      runTransaction(database, () => {
        database.prepare(
          `INSERT INTO prepared_encounters
            (id, session_id, name, notes, sort_order, revision, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
        ).run(id, sessionId, input.name, input.notes, input.sortOrder, now, now);
        replacePreparedMonsters(database, campaignId, id, input.monsters);
        touch(database, campaignId, actorUserId, "prepared_encounter", id, "created");
      });
      return getPrepared(database, id);
    },

    updatePrepared(
      campaignId: string,
      actorUserId: string,
      id: string,
      expectedRevision: number,
      input: Pick<V6PreparedEncounter, "name" | "notes" | "sortOrder" | "monsters">,
    ): V6PreparedEncounter {
      requireCampaignEdit(database, campaignId, actorUserId);
      runTransaction(database, () => {
        const result = database.prepare(
          `UPDATE prepared_encounters SET name = ?, notes = ?, sort_order = ?,
             revision = revision + 1, updated_at = ?
           WHERE id = ? AND revision = ? AND session_id IN
             (SELECT id FROM sessions WHERE campaign_id = ?)`,
        ).run(input.name, input.notes, input.sortOrder, Date.now(), id, expectedRevision, campaignId);
        if (!result.changes) conflictOrMissing(database, "prepared_encounters", "prepared encounter", id, expectedRevision);
        replacePreparedMonsters(database, campaignId, id, input.monsters);
        touch(database, campaignId, actorUserId, "prepared_encounter", id, "updated");
      });
      return getPrepared(database, id);
    },

    deletePrepared(campaignId: string, actorUserId: string, id: string): void {
      requireCampaignEdit(database, campaignId, actorUserId);
      const result = database.prepare(
        `DELETE FROM prepared_encounters WHERE id = ? AND session_id IN
          (SELECT id FROM sessions WHERE campaign_id = ?)`,
      ).run(id, campaignId);
      if (!result.changes) throw new ResourceNotFoundError("prepared encounter", id);
      touch(database, campaignId, actorUserId, "prepared_encounter", id, "deleted");
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
        throw new RevisionConflictError("combat", current.id, expectedRevision, current.revision);
      runTransaction(database, () => {
        database.prepare(
          `INSERT INTO combat_history
            (encounter_id, actor_user_id, action, before_state, created_at)
           VALUES (?, ?, ?, ?, ?)`,
        ).run(current.id, actorUserId, action, JSON.stringify(current), Date.now());
        pruneCombatHistory(database, current.id);
        const result = database.prepare(
          `UPDATE combat_encounters SET name = ?, round = ?, turn = ?,
             revision = revision + 1, updated_at = ?
           WHERE id = ? AND revision = ?`,
        ).run(input.name, input.round, input.turn, Date.now(), current.id, expectedRevision);
        if (!result.changes)
          conflictOrMissing(database, "combat_encounters", "combat", current.id, expectedRevision);
        replaceCombatants(database, current.id, input.combatants);
        touch(database, campaignId, actorUserId, "combat", current.id, action);
      });
      return getCombat(database, current.id);
    },

    undoCombat(campaignId: string, actorUserId: string): V6CombatEncounter {
      requireCampaignEdit(database, campaignId, actorUserId);
      const current = getOrCreateCombat(database, campaignId);
      const history = database.prepare(
        `SELECT id, before_state AS beforeState FROM combat_history
          WHERE encounter_id = ? ORDER BY id DESC LIMIT 1`,
      ).get(current.id) as { id: number; beforeState: string } | undefined;
      if (!history) return current;
      const previous = JSON.parse(history.beforeState) as V6CombatEncounter;
      runTransaction(database, () => {
        database.prepare(
          `UPDATE combat_encounters SET name = ?, round = ?, turn = ?,
             revision = revision + 1, updated_at = ? WHERE id = ?`,
        ).run(previous.name, previous.round, previous.turn, Date.now(), current.id);
        replaceCombatants(database, current.id, previous.combatants);
        database.prepare("DELETE FROM combat_history WHERE id = ?").run(history.id);
        touch(database, campaignId, actorUserId, "combat", current.id, "undo");
      });
      return getCombat(database, current.id);
    },
  };
}

function pruneCombatHistory(database: DatabaseSync, encounterId: string): void {
  const limit = getV6ServerSettings(database).combatHistoryLimit;
  const cutoff = database.prepare(
    "SELECT id FROM combat_history WHERE encounter_id = ? ORDER BY id DESC LIMIT 1 OFFSET ?",
  ).get(encounterId, limit) as { id: number } | undefined;
  if (cutoff)
    database.prepare("DELETE FROM combat_history WHERE encounter_id = ? AND id <= ?").run(encounterId, cutoff.id);
}

function replacePreparedMonsters(
  database: DatabaseSync,
  campaignId: string,
  encounterId: string,
  monsters: PreparedMonster[],
): void {
  database.prepare("DELETE FROM prepared_encounter_monsters WHERE encounter_id = ?").run(encounterId);
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
      entry.id || crypto.randomUUID(), encounterId, entry.monsterId,
      entry.displayNumber, Math.max(1, entry.quantity), entry.sortOrder,
    );
  }
}

function replaceCombatants(
  database: DatabaseSync,
  encounterId: string,
  combatants: V6Combatant[],
): void {
  database.prepare("DELETE FROM combatants WHERE encounter_id = ?").run(encounterId);
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
  const now = Date.now();
  for (const combatant of combatants) {
    const combatantId = combatant.id || crypto.randomUUID();
    insertCombatant.run(
      combatantId, encounterId, combatant.playerId,
      combatant.monsterId, combatant.name, combatant.displayNumber,
      combatant.kind, combatant.notes ?? "", combatant.initiative, combatant.hitPoints,
      combatant.maximumHitPoints, combatant.armorClass, combatant.sortOrder,
      combatant.revision || 1, now, now,
    );
    for (const condition of combatant.conditions) {
      insertCondition.run(
        condition.id || crypto.randomUUID(), combatantId, condition.name,
        condition.remainingTurns, now,
      );
    }
  }
}

function getOrCreateCombat(database: DatabaseSync, campaignId: string): V6CombatEncounter {
  let row = database.prepare(
    `SELECT id, campaign_id AS campaignId, name, round, turn, revision,
            created_at AS createdAt, updated_at AS updatedAt
       FROM combat_encounters WHERE campaign_id = ?`,
  ).get(campaignId) as CombatRow | undefined;
  if (!row) {
    const now = Date.now();
    const id = crypto.randomUUID();
    database.prepare(
      `INSERT INTO combat_encounters
        (id, campaign_id, name, round, turn, revision, created_at, updated_at)
       VALUES (?, ?, 'Encounter', 1, 0, 1, ?, ?)`,
    ).run(id, campaignId, now, now);
    row = database.prepare(
      `SELECT id, campaign_id AS campaignId, name, round, turn, revision,
              created_at AS createdAt, updated_at AS updatedAt
         FROM combat_encounters WHERE id = ?`,
    ).get(id) as CombatRow;
  }
  return combatFromRow(database, row);
}

function getCombat(database: DatabaseSync, id: string): V6CombatEncounter {
  const row = database.prepare(
    `SELECT id, campaign_id AS campaignId, name, round, turn, revision,
            created_at AS createdAt, updated_at AS updatedAt
       FROM combat_encounters WHERE id = ?`,
  ).get(id) as CombatRow | undefined;
  if (!row) throw new ResourceNotFoundError("combat", id);
  return combatFromRow(database, row);
}

function combatFromRow(database: DatabaseSync, row: CombatRow): V6CombatEncounter {
  const combatants = database.prepare(
    `SELECT id, player_id AS playerId, monster_id AS monsterId, name,
            display_number AS displayNumber, kind, notes, initiative,
            hit_points AS hitPoints, maximum_hit_points AS maximumHitPoints,
            armor_class AS armorClass, sort_order AS sortOrder, revision
       FROM combatants WHERE encounter_id = ? ORDER BY sort_order, id`,
  ).all(row.id) as Array<Omit<V6Combatant, "conditions">>;
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
  const row = database.prepare(
    `SELECT id, session_id AS sessionId, name, notes, sort_order AS sortOrder,
            revision, created_at AS createdAt, updated_at AS updatedAt
       FROM prepared_encounters WHERE id = ?`,
  ).get(id) as PreparedRow | undefined;
  if (!row) throw new ResourceNotFoundError("prepared encounter", id);
  return preparedFromRow(database, row);
}

function preparedFromRow(database: DatabaseSync, row: PreparedRow): V6PreparedEncounter {
  const monsters = database.prepare(
    `SELECT id, monster_id AS monsterId, display_number AS displayNumber,
            quantity, sort_order AS sortOrder
       FROM prepared_encounter_monsters WHERE encounter_id = ?
      ORDER BY sort_order, id`,
  ).all(row.id) as PreparedMonster[];
  return {
    ...row,
    monsters,
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString(),
  };
}

function ensureSession(database: DatabaseSync, campaignId: string, sessionId: string): void {
  if (!database.prepare(
    "SELECT id FROM sessions WHERE id = ? AND campaign_id = ? LIMIT 1",
  ).get(sessionId, campaignId)) throw new ResourceNotFoundError("session", sessionId);
}

function conflictOrMissing(
  database: DatabaseSync,
  table: "prepared_encounters" | "combat_encounters",
  type: string,
  id: string,
  expectedRevision: number,
): never {
  const row = database.prepare(`SELECT revision FROM ${table} WHERE id = ?`).get(id) as
    | { revision: number }
    | undefined;
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
  database.prepare(
    "UPDATE campaigns SET revision = revision + 1, updated_at = ? WHERE id = ?",
  ).run(Date.now(), campaignId);
  recordAuditEvent(database, {
    campaignId, actorUserId, resourceType, resourceId, action,
  });
}
