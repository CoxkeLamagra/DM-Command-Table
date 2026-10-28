import { assertMonsterReadBudget } from "../bestiary/read-budget.ts";
import { parseInput } from "../http/validation.ts";
import { statement } from "../../db/statements.ts";
import {
  emptyRuntime,
  runtimeForSnapshot,
  snapshotMonster,
} from "../../domain/combat-runtime.ts";
import { createBestiaryRepository } from "../bestiary/bestiary-repository.ts";
import { orderedCombatants, uniquePlayers } from "../../domain/combat.ts";
import { sanitizeRichText } from "../security/sanitize-rich-text.ts";
import { combatRuntimeSchema, combatSnapshotSchema } from "../http/schemas.ts";
import type { DatabaseSync } from "node:sqlite";
import { ResourceNotFoundError } from "../http/conflicts.ts";
import { getServerSettings } from "../administration/server-settings.ts";
import { PublicApiError } from "../http/errors.ts";
import type {
  CombatCondition,
  Combatant,
  CombatEncounter,
} from "../../domain/encounters.ts";

type CombatRow = Omit<
  CombatEncounter,
  "combatants" | "createdAt" | "updatedAt"
> & {
  createdAt: number;
  updatedAt: number;
  activeCombatantId: string | null;
};

export function pruneCombatHistory(
  database: DatabaseSync,
  encounterId: string,
): void {
  const limit = getServerSettings(database).combatHistoryLimit;
  const cutoff = statement(
    database,
    "SELECT id FROM combat_history WHERE encounter_id = ? ORDER BY id DESC LIMIT 1 OFFSET ?",
  ).get(encounterId, limit) as { id: number } | undefined;
  statement(
    database,
    `DELETE FROM combat_history WHERE id IN (
    SELECT id FROM (SELECT id, SUM(length(COALESCE(before_state,''))) OVER (ORDER BY id DESC) AS bytes
    FROM combat_history WHERE encounter_id=?) WHERE bytes > 25*1024*1024)`,
  ).run(encounterId);
  if (cutoff)
    statement(
      database,
      "DELETE FROM combat_history WHERE encounter_id = ? AND id <= ?",
    ).run(encounterId, cutoff.id);
  statement(
    database,
    "DELETE FROM screenshot_references WHERE resource_type='combat_history' AND resource_id NOT IN (SELECT CAST(id AS TEXT) FROM combat_history)",
  ).run();
}

export function replaceCombatants(
  database: DatabaseSync,
  campaignId: string,
  encounterId: string,
  combatants: Combatant[],
): void {
  if (new Set(combatants.map((entry) => entry.id)).size !== combatants.length)
    throw new PublicApiError("Combatant IDs must be unique.");
  if (uniquePlayers(combatants).length !== combatants.length)
    throw new PublicApiError(
      "Players must have unique names in combat. Duplicate names are allowed only for Monsters and NPCs.",
    );
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
  const remove = statement(
    database,
    "DELETE FROM combatants WHERE id=? AND encounter_id=?",
  );
  for (const entry of prior)
    if (!inputById.has(entry.id) || !unchanged.has(entry.id))
      remove.run(entry.id, encounterId);
  const insertCombatant = statement(
    database,
    `INSERT INTO combatants
      (id, encounter_id, player_id, monster_id, name, display_number, kind,
       notes, initiative, hit_points, maximum_hit_points, armor_class,
       sort_order, revision, created_at, updated_at, runtime, snapshot)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const insertCondition = statement(
    database,
    `INSERT INTO combat_conditions
      (id, combatant_id, name, remaining_turns, created_at, timing, requires_save, save_due) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const validPlayer = statement(
    database,
    "SELECT id FROM players WHERE id = ? AND campaign_id = ? LIMIT 1",
  );
  const validMonster = statement(
    database,
    "SELECT id FROM monsters WHERE id = ? AND campaign_id = ? LIMIT 1",
  );
  const now = Date.now();
  const quantities = new Map<string, number>();
  for (const entry of combatants)
    if (entry.monsterId && !entry.snapshot && !byId.get(entry.id)?.snapshot)
      quantities.set(
        entry.monsterId,
        (quantities.get(entry.monsterId) ?? 0) + 1,
      );
  const needsSnapshot = quantities.size > 0;
  if (needsSnapshot)
    assertMonsterReadBudget(
      database,
      campaignId,
      [...quantities.keys()],
      quantities,
    );
  const monsters = new Map(
    needsSnapshot
      ? createBestiaryRepository(database)
          .list(
            campaignId,
            (
              statement(
                database,
                "SELECT owner_id AS owner FROM campaigns WHERE id=?",
              ).get(campaignId) as { owner: string }
            ).owner,
            [...quantities.keys()],
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
      ? parseInput(combatSnapshotSchema, submittedSnapshot)
      : null;
    if (snapshot) {
      snapshot.stats = sanitizeRichText(snapshot.stats);
      snapshot.token = sanitizeRichText(snapshot.token ?? "");
      snapshot.abilities = sanitizeRichText(snapshot.abilities);
      snapshot.spells = sanitizeRichText(snapshot.spells);
      snapshot.notes = sanitizeRichText(snapshot.notes);
    }
    const runtime = parseInput(
      combatRuntimeSchema,
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

export function getOrCreateCombat(
  database: DatabaseSync,
  campaignId: string,
): CombatEncounter {
  let row = statement(
    database,
    `SELECT id, campaign_id AS campaignId, name, round, turn, active_combatant_id AS activeCombatantId, revision,
            created_at AS createdAt, updated_at AS updatedAt
       FROM combat_encounters WHERE campaign_id = ?`,
  ).get(campaignId) as CombatRow | undefined;
  if (!row) {
    const now = Date.now();
    const id = crypto.randomUUID();
    statement(
      database,
      `INSERT INTO combat_encounters
        (id, campaign_id, name, round, turn, revision, created_at, updated_at)
       VALUES (?, ?, 'Encounter', 1, 0, 1, ?, ?)`,
    ).run(id, campaignId, now, now);
    row = statement(
      database,
      `SELECT id, campaign_id AS campaignId, name, round, turn, active_combatant_id AS activeCombatantId, revision,
              created_at AS createdAt, updated_at AS updatedAt
         FROM combat_encounters WHERE id = ?`,
    ).get(id) as CombatRow;
  }
  return combatFromRow(database, row);
}

export function getCombat(database: DatabaseSync, id: string): CombatEncounter {
  const row = statement(
    database,
    `SELECT id, campaign_id AS campaignId, name, round, turn, active_combatant_id AS activeCombatantId, revision,
            created_at AS createdAt, updated_at AS updatedAt
       FROM combat_encounters WHERE id = ?`,
  ).get(id) as CombatRow | undefined;
  if (!row) throw new ResourceNotFoundError("combat", id);
  return combatFromRow(database, row);
}

function combatFromRow(
  database: DatabaseSync,
  row: CombatRow,
): CombatEncounter {
  const combatants = statement(
    database,
    `SELECT id, player_id AS playerId, monster_id AS monsterId, name,
            display_number AS displayNumber, kind, notes, initiative,
            hit_points AS hitPoints, maximum_hit_points AS maximumHitPoints,
            armor_class AS armorClass, sort_order AS sortOrder, revision, runtime, snapshot
       FROM combatants WHERE encounter_id = ? ORDER BY sort_order, id`,
  ).all(row.id) as Array<
    Omit<Combatant, "conditions" | "runtime" | "snapshot"> & {
      runtime: string;
      snapshot: string | null;
    }
  >;
  const conditionRows = statement(
    database,
    `SELECT cc.id,cc.name,cc.remaining_turns AS remainingTurns,cc.timing,cc.requires_save AS requiresSave,cc.save_due AS saveDue,cc.combatant_id AS combatantId
    FROM combat_conditions cc JOIN combatants c ON c.id=cc.combatant_id WHERE c.encounter_id=? ORDER BY cc.created_at,cc.id`,
  ).all(row.id) as Array<
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
      runtime: parseInput(combatRuntimeSchema, JSON.parse(runtime)),
      snapshot: snapshot
        ? parseInput(combatSnapshotSchema, JSON.parse(snapshot))
        : null,
      conditions: conditions.get(combatant.id) ?? [],
    })),
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString(),
  };
}
