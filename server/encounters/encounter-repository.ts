import {
  combatRichText,
  emptyRuntime,
  runtimeForSnapshot,
  snapshotMonster,
} from "../../domain/combat-runtime.ts";
import { createBestiaryRepository } from "../bestiary/bestiary-repository.ts";
import {
  assertPreparedCapacity,
  orderedCombatants,
} from "../../domain/combat.ts";
import { sanitizeRichText } from "../security/sanitize-rich-text.ts";
import {
  combatRuntimeSchema,
  combatSnapshotSchema,
  preparedCombatantSchema,
  preparedEncounterFields,
} from "../http/schemas.ts";
import type { DatabaseSync } from "node:sqlite";
import { runTransaction } from "../../db/transaction.ts";
import {
  requireCampaignEdit,
  requireCampaignRead,
} from "../campaigns/access.ts";
import { recordAuditEvent } from "../support/audit.ts";
import {
  ResourceNotFoundError,
  RevisionConflictError,
} from "../http/conflicts.ts";
import { getServerSettings } from "../administration/server-settings.ts";
import { PublicApiError } from "../http/errors.ts";
import { syncScreenshotReferences } from "../media/screenshots.ts";

import type {
  PreparedMonster,
  PreparedCombatant,
  PreparedEncounter,
  CombatCondition,
  Combatant,
  CombatEncounter,
} from "../../domain/encounters.ts";
export type {
  PreparedMonster,
  PreparedEncounter,
  CombatCondition,
  Combatant,
  CombatEncounter,
} from "../../domain/encounters.ts";

type PreparedRow = Omit<
  PreparedEncounter,
  "monsters" | "combatants" | "createdAt" | "updatedAt"
> & {
  createdAt: number;
  updatedAt: number;
};
type CombatRow = Omit<
  CombatEncounter,
  "combatants" | "createdAt" | "updatedAt"
> & {
  createdAt: number;
  updatedAt: number;
  activeCombatantId: string | null;
};

export function createEncounterRepository(database: DatabaseSync) {
  return {
    listPrepared(
      campaignId: string,
      actorUserId: string,
      sessionId: string,
    ): PreparedEncounter[] {
      requireCampaignRead(database, campaignId, actorUserId);
      ensureSession(database, campaignId, sessionId);
      const rows = database
        .prepare(
          `SELECT id, session_id AS sessionId, name, notes, sort_order AS sortOrder,
                revision, created_at AS createdAt, updated_at AS updatedAt
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
      const copies = database
        .prepare(
          `SELECT pc.id,pc.encounter_id AS encounterId,pc.name,pc.kind,pc.notes,pc.display_number AS displayNumber,pc.initiative,pc.hit_points AS hitPoints,pc.maximum_hit_points AS maximumHitPoints,pc.armor_class AS armorClass,pc.sort_order AS sortOrder FROM prepared_combatants pc JOIN prepared_encounters e ON e.id=pc.encounter_id WHERE e.session_id=? ORDER BY pc.sort_order,pc.id`,
        )
        .all(sessionId) as Array<PreparedCombatant & { encounterId: string }>;
      const groupedCopies = new Map<string, PreparedCombatant[]>();
      for (const { encounterId, ...copy } of copies) {
        const values = groupedCopies.get(encounterId) ?? [];
        values.push(copy);
        groupedCopies.set(encounterId, values);
      }
      return rows.map((row) =>
        preparedFromRow(
          database,
          row,
          grouped.get(row.id) ?? [],
          groupedCopies.get(row.id) ?? [],
        ),
      );
    },

    createPrepared(
      campaignId: string,
      actorUserId: string,
      sessionId: string,
      input: Pick<
        PreparedEncounter,
        "name" | "notes" | "sortOrder" | "monsters" | "combatants"
      >,
    ): PreparedEncounter {
      requireCampaignEdit(database, campaignId, actorUserId);
      assertPreparedCapacity(input);
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
            sanitizeRichText(input.notes),
            input.sortOrder,
            now,
            now,
          );
        const combatants = preparedEncounterFields.shape.combatants
          .parse(input.combatants ?? [])
          .map((entry) => {
            const value = preparedCombatantSchema.parse(entry);
            return { ...value, notes: sanitizeRichText(value.notes) };
          });
        replacePreparedCombatants(database, id, combatants);
        replacePreparedMonsters(database, campaignId, id, input.monsters);
        touch(
          database,
          campaignId,
          actorUserId,
          "prepared_encounter",
          id,
          "created",
        );
        syncScreenshotReferences(
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
        PreparedEncounter,
        "name" | "notes" | "sortOrder" | "monsters" | "combatants"
      >,
    ): PreparedEncounter {
      requireCampaignEdit(database, campaignId, actorUserId);
      assertPreparedCapacity(input);
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
            sanitizeRichText(input.notes),
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
        const combatants = preparedEncounterFields.shape.combatants
          .parse(input.combatants ?? [])
          .map((entry) => {
            const value = preparedCombatantSchema.parse(entry);
            return { ...value, notes: sanitizeRichText(value.notes) };
          });
        replacePreparedCombatants(database, id, combatants);
        replacePreparedMonsters(database, campaignId, id, input.monsters);
        touch(
          database,
          campaignId,
          actorUserId,
          "prepared_encounter",
          id,
          "updated",
        );
        syncScreenshotReferences(
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
        syncScreenshotReferences(
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
        const historyInsert = database
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
        syncScreenshotReferences(
          database,
          campaignId,
          actorUserId,
          "combat_history",
          String(historyInsert.lastInsertRowid),
          ...current.combatants.flatMap(combatRichText),
        );
        pruneCombatHistory(database, current.id);
        const result = database
          .prepare(
            `UPDATE combat_encounters SET name = ?, round = ?, turn = ?, active_combatant_id = ?,
             revision = revision + 1, updated_at = ?
           WHERE id = ? AND revision = ?`,
          )
          .run(
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
      const history = database
        .prepare(
          `SELECT id, before_state AS beforeState FROM combat_history
          WHERE encounter_id = ? ORDER BY id DESC LIMIT 1`,
        )
        .get(current.id) as { id: number; beforeState: string } | undefined;
      if (!history) return current;
      const previous = JSON.parse(history.beforeState) as CombatEncounter;
      const players = new Set(
        (
          database
            .prepare("SELECT id FROM players WHERE campaign_id=?")
            .all(campaignId) as Array<{ id: string }>
        ).map((value) => value.id),
      );
      const monsters = new Set(
        (
          database
            .prepare("SELECT id FROM monsters WHERE campaign_id=?")
            .all(campaignId) as Array<{ id: string }>
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
        const updated = database
          .prepare(
            `UPDATE combat_encounters SET name = ?, round = ?, turn = ?, active_combatant_id = ?,
             revision = revision + 1, updated_at = ? WHERE id = ? AND revision = ?`,
          )
          .run(
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
        database
          .prepare("DELETE FROM combat_history WHERE id = ?")
          .run(history.id);
        touch(database, campaignId, actorUserId, "combat", current.id, "undo");
        syncScreenshotReferences(
          database,
          campaignId,
          actorUserId,
          "combat",
          current.id,
          ...getCombat(database, current.id).combatants.flatMap(combatRichText),
        );
        database
          .prepare(
            "DELETE FROM screenshot_references WHERE resource_type='combat_history' AND resource_id=?",
          )
          .run(String(history.id));
      });
      return getCombat(database, current.id);
    },
  };
}

function pruneCombatHistory(database: DatabaseSync, encounterId: string): void {
  const limit = getServerSettings(database).combatHistoryLimit;
  const cutoff = database
    .prepare(
      "SELECT id FROM combat_history WHERE encounter_id = ? ORDER BY id DESC LIMIT 1 OFFSET ?",
    )
    .get(encounterId, limit) as { id: number } | undefined;
  database
    .prepare(
      `DELETE FROM combat_history WHERE id IN (
    SELECT id FROM (SELECT id, SUM(length(COALESCE(before_state,''))) OVER (ORDER BY id DESC) AS bytes
    FROM combat_history WHERE encounter_id=?) WHERE bytes > 25*1024*1024)`,
    )
    .run(encounterId);
  if (cutoff)
    database
      .prepare("DELETE FROM combat_history WHERE encounter_id = ? AND id <= ?")
      .run(encounterId, cutoff.id);
  database
    .prepare(
      "DELETE FROM screenshot_references WHERE resource_type='combat_history' AND resource_id NOT IN (SELECT CAST(id AS TEXT) FROM combat_history)",
    )
    .run();
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
  combatants: Combatant[],
): void {
  if (new Set(combatants.map((entry) => entry.id)).size !== combatants.length)
    throw new PublicApiError("Combatant IDs must be unique.");
  const prior = getCombat(database, encounterId).combatants;
  const byId = new Map(prior.map((entry) => [entry.id, entry]));
  const inputById = new Map(combatants.map((entry) => [entry.id, entry]));
  const unchanged = new Set(
    combatants
      .filter(
        (entry) => JSON.stringify(entry) === JSON.stringify(byId.get(entry.id)),
      )
      .map((entry) => entry.id),
  );
  const remove = database.prepare(
    "DELETE FROM combatants WHERE id=? AND encounter_id=?",
  );
  for (const entry of prior)
    if (!inputById.has(entry.id) || !unchanged.has(entry.id))
      remove.run(entry.id, encounterId);
  const insertCombatant = database.prepare(
    `INSERT INTO combatants
      (id, encounter_id, player_id, monster_id, name, display_number, kind,
       notes, initiative, hit_points, maximum_hit_points, armor_class,
       sort_order, revision, created_at, updated_at, runtime, snapshot)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const insertCondition = database.prepare(
    `INSERT INTO combat_conditions
      (id, combatant_id, name, remaining_turns, created_at, timing, requires_save, save_due) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const validPlayer = database.prepare(
    "SELECT id FROM players WHERE id = ? AND campaign_id = ? LIMIT 1",
  );
  const validMonster = database.prepare(
    "SELECT id FROM monsters WHERE id = ? AND campaign_id = ? LIMIT 1",
  );
  const now = Date.now();
  const needsSnapshot = combatants.some(
    (entry) =>
      entry.monsterId && !entry.snapshot && !byId.get(entry.id)?.snapshot,
  );
  const monsters = new Map(
    needsSnapshot
      ? createBestiaryRepository(database)
          .list(
            campaignId,
            (
              database
                .prepare("SELECT owner_id AS owner FROM campaigns WHERE id=?")
                .get(campaignId) as { owner: string }
            ).owner,
          )
          .map((monster) => [monster.id, monster] as const)
      : [],
  );
  for (const combatant of combatants) {
    if (unchanged.has(combatant.id)) continue;
    if (
      combatant.playerId &&
      (!validPlayer.get(combatant.playerId, campaignId) ||
        !["player", "npc"].includes(combatant.kind) ||
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
    if (combatant.kind === "npc" && combatant.monsterId)
      throw new PublicApiError(
        "NPC combatants cannot reference Bestiary monsters.",
      );
    const priorSnapshot = byId.get(combatant.id)?.snapshot;
    const source = combatant.monsterId
      ? monsters.get(combatant.monsterId)
      : undefined;
    const submittedSnapshot =
      combatant.snapshot ??
      priorSnapshot ??
      (source ? snapshotMonster(source) : null);
    const snapshot = submittedSnapshot
      ? combatSnapshotSchema.parse(submittedSnapshot)
      : null;
    if (snapshot) {
      snapshot.stats = sanitizeRichText(snapshot.stats);
      snapshot.abilities = sanitizeRichText(snapshot.abilities);
      snapshot.spells = sanitizeRichText(snapshot.spells);
      snapshot.notes = sanitizeRichText(snapshot.notes);
    }
    const runtime = combatRuntimeSchema.parse(
      combatant.runtime ??
        byId.get(combatant.id)?.runtime ??
        (snapshot ? runtimeForSnapshot(snapshot) : emptyRuntime()),
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
      sanitizeRichText(combatant.notes ?? ""),
      combatant.initiative,
      combatant.hitPoints,
      combatant.maximumHitPoints,
      combatant.armorClass,
      combatant.sortOrder,
      combatant.revision || 1,
      now,
      now,
      JSON.stringify(runtime),
      snapshot ? JSON.stringify(snapshot) : null,
    );
    for (const condition of combatant.conditions) {
      insertCondition.run(
        condition.id || crypto.randomUUID(),
        combatantId,
        condition.name,
        condition.remainingTurns,
        now,
        condition.timing ??
          (condition.remainingTurns === null ? "manual" : "start-turn"),
        condition.requiresSave ? 1 : 0,
        condition.saveDue ? 1 : 0,
      );
    }
  }
}

function getOrCreateCombat(
  database: DatabaseSync,
  campaignId: string,
): CombatEncounter {
  let row = database
    .prepare(
      `SELECT id, campaign_id AS campaignId, name, round, turn, active_combatant_id AS activeCombatantId, revision,
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
        `SELECT id, campaign_id AS campaignId, name, round, turn, active_combatant_id AS activeCombatantId, revision,
              created_at AS createdAt, updated_at AS updatedAt
         FROM combat_encounters WHERE id = ?`,
      )
      .get(id) as CombatRow;
  }
  return combatFromRow(database, row);
}

function getCombat(database: DatabaseSync, id: string): CombatEncounter {
  const row = database
    .prepare(
      `SELECT id, campaign_id AS campaignId, name, round, turn, active_combatant_id AS activeCombatantId, revision,
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
): CombatEncounter {
  const combatants = database
    .prepare(
      `SELECT id, player_id AS playerId, monster_id AS monsterId, name,
            display_number AS displayNumber, kind, notes, initiative,
            hit_points AS hitPoints, maximum_hit_points AS maximumHitPoints,
            armor_class AS armorClass, sort_order AS sortOrder, revision, runtime, snapshot
       FROM combatants WHERE encounter_id = ? ORDER BY sort_order, id`,
    )
    .all(row.id) as Array<
    Omit<Combatant, "conditions" | "runtime" | "snapshot"> & {
      runtime: string;
      snapshot: string | null;
    }
  >;
  const conditionRows = database
    .prepare(
      `SELECT cc.id,cc.name,cc.remaining_turns AS remainingTurns,cc.timing,cc.requires_save AS requiresSave,cc.save_due AS saveDue,cc.combatant_id AS combatantId
    FROM combat_conditions cc JOIN combatants c ON c.id=cc.combatant_id WHERE c.encounter_id=? ORDER BY cc.created_at,cc.id`,
    )
    .all(row.id) as Array<
    Omit<CombatCondition, "requiresSave" | "saveDue"> & {
      combatantId: string;
      requiresSave: number;
      saveDue: number;
    }
  >;
  const conditions = new Map<string, CombatCondition[]>();
  for (const { combatantId, ...condition } of conditionRows) {
    const entries = conditions.get(combatantId) ?? [];
    entries.push({
      ...condition,
      requiresSave: !!condition.requiresSave,
      saveDue: !!condition.saveDue,
    });
    conditions.set(combatantId, entries);
  }
  const { activeCombatantId, ...metadata } = row;
  const activeIndex = orderedCombatants(
    combatants.map((entry) => ({
      ...entry,
      runtime: undefined,
      snapshot: undefined,
      conditions: [],
    })),
  ).findIndex((entry) => entry.id === activeCombatantId);
  return {
    ...metadata,
    turn: activeIndex >= 0 ? activeIndex : row.turn,
    combatants: combatants.map(({ runtime, snapshot, ...combatant }) => ({
      ...combatant,
      runtime: combatRuntimeSchema.parse(JSON.parse(runtime)),
      snapshot: snapshot
        ? combatSnapshotSchema.parse(JSON.parse(snapshot))
        : null,
      conditions: conditions.get(combatant.id) ?? [],
    })),
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString(),
  };
}

function getPrepared(database: DatabaseSync, id: string): PreparedEncounter {
  const row = database
    .prepare(
      `SELECT id, session_id AS sessionId, name, notes, sort_order AS sortOrder,
            revision, created_at AS createdAt, updated_at AS updatedAt
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
  suppliedCombatants?: PreparedCombatant[],
): PreparedEncounter {
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
    combatants:
      suppliedCombatants ??
      (database
        .prepare(
          `SELECT id, name, kind, notes,
      display_number AS displayNumber, initiative, hit_points AS hitPoints,
      maximum_hit_points AS maximumHitPoints, armor_class AS armorClass,
      sort_order AS sortOrder FROM prepared_combatants WHERE encounter_id = ?
      ORDER BY sort_order, id`,
        )
        .all(row.id)
        .map((entry) => ({ ...entry })) as PreparedCombatant[]),
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

function replacePreparedCombatants(
  database: DatabaseSync,
  encounterId: string,
  entries: PreparedCombatant[],
): void {
  database
    .prepare("DELETE FROM prepared_combatants WHERE encounter_id = ?")
    .run(encounterId);
  const insert = database.prepare(`INSERT INTO prepared_combatants
 (id,encounter_id,name,kind,notes,display_number,initiative,hit_points,maximum_hit_points,armor_class,sort_order)
 VALUES (?,?,?,?,?,?,?,?,?,?,?)`);
  for (const entry of entries)
    insert.run(
      entry.id,
      encounterId,
      entry.name,
      entry.kind,
      sanitizeRichText(entry.notes),
      entry.displayNumber,
      entry.initiative,
      entry.hitPoints,
      entry.maximumHitPoints,
      entry.armorClass,
      entry.sortOrder,
    );
}
