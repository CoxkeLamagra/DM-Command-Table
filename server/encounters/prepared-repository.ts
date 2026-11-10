import { parseInput } from "../http/validation.ts";
import { PublicApiError } from "../http/errors.ts";
import { statement } from "../../db/statements.ts";
import { assertPreparedCapacity } from "../../domain/combat.ts";
import { sanitizeRichText } from "../security/sanitize-rich-text.ts";
import { preparedEncounterFields } from "../http/schemas.ts";
import type { DatabaseSync } from "node:sqlite";
import { runTransaction } from "../../db/transaction.ts";
import {
  requireCampaignEdit,
  requireCampaignRead,
} from "../campaigns/access.ts";
import { ResourceNotFoundError } from "../http/conflicts.ts";
import { syncScreenshotReferences } from "../media/screenshots.ts";
import type {
  PreparedMonster,
  PreparedCombatant,
  PreparedEncounter,
} from "../../domain/encounters.ts";
import { conflictOrMissing, touch } from "./persistence.ts";
type PreparedRow = Omit<
  PreparedEncounter,
  "monsters" | "combatants" | "createdAt" | "updatedAt"
> & {
  createdAt: number;
  updatedAt: number;
};

export function createPreparedRepository(database: DatabaseSync) {
  return {
    listPrepared(
      campaignId: string,
      actorUserId: string,
      sessionId: string,
    ): PreparedEncounter[] {
      requireCampaignRead(database, campaignId, actorUserId);
      ensureSession(database, campaignId, sessionId);
      const rows = statement(
        database,
        `SELECT id, session_id AS sessionId, name, notes, sort_order AS sortOrder,
                revision, created_at AS createdAt, updated_at AS updatedAt
           FROM prepared_encounters WHERE session_id = ? ORDER BY sort_order, id`,
      ).all(sessionId) as PreparedRow[];
      const allMonsters = statement(
        database,
        `SELECT m.id, m.encounter_id AS encounterId, m.monster_id AS monsterId,
        m.display_number AS displayNumber, m.quantity, m.sort_order AS sortOrder
        FROM prepared_encounter_monsters m JOIN prepared_encounters e ON e.id = m.encounter_id
        WHERE e.session_id = ? ORDER BY m.sort_order, m.id`,
      ).all(sessionId) as Array<PreparedMonster & { encounterId: string }>;
      const grouped = new Map<string, PreparedMonster[]>();
      for (const { encounterId, ...monster } of allMonsters) {
        const group = grouped.get(encounterId) ?? [];
        group.push(monster);
        grouped.set(encounterId, group);
      }
      const copies = statement(
        database,
        `SELECT pc.id,pc.encounter_id AS encounterId,pc.name,pc.kind,pc.notes,pc.display_number AS displayNumber,pc.initiative,pc.hit_points AS hitPoints,pc.maximum_hit_points AS maximumHitPoints,pc.armor_class AS armorClass,pc.sort_order AS sortOrder FROM prepared_combatants pc JOIN prepared_encounters e ON e.id=pc.encounter_id WHERE e.session_id=? ORDER BY pc.sort_order,pc.id`,
      ).all(sessionId) as Array<PreparedCombatant & { encounterId: string }>;
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

    requirePreparedSession(
      campaignId: string,
      actorUserId: string,
      sessionId: string,
      encounterId: string,
    ): void {
      requireCampaignRead(database, campaignId, actorUserId);
      if (
        !statement(
          database,
          `SELECT e.id FROM prepared_encounters e JOIN sessions s ON s.id=e.session_id WHERE e.id=? AND s.id=? AND s.campaign_id=?`,
        ).get(encounterId, sessionId, campaignId)
      )
        throw new ResourceNotFoundError("prepared encounter", encounterId);
    },

    reorderPrepared(
      campaignId: string,
      actorUserId: string,
      sessionId: string,
      order: { id: string; revision: number }[],
    ): PreparedEncounter[] {
      requireCampaignEdit(database, campaignId, actorUserId);
      ensureSession(database, campaignId, sessionId);
      return runTransaction(database, () => {
        const current = statement(
          database,
          "SELECT id FROM prepared_encounters WHERE session_id=?",
        ).all(sessionId) as { id: string }[];
        const allowed = new Set(current.map(({ id }) => id));
        if (
          order.length !== current.length ||
          new Set(order.map(({ id }) => id)).size !== current.length ||
          order.some(({ id }) => !allowed.has(id))
        )
          throw new PublicApiError(
            "Prepared encounters changed. Reload before reordering.",
            409,
          );
        const updateOrder = statement(
          database,
          "UPDATE prepared_encounters SET sort_order=?, revision=revision+1, updated_at=? WHERE id=? AND session_id=? AND revision=?",
        );
        const now = Date.now();
        order.forEach(({ id, revision }, index) => {
          const result = updateOrder.run(index, now, id, sessionId, revision);
          if (!result.changes)
            conflictOrMissing(
              database,
              "prepared_encounters",
              "prepared encounter",
              id,
              revision,
              campaignId,
            );
        });
        touch(
          database,
          campaignId,
          actorUserId,
          "session",
          sessionId,
          "encounters_reordered",
        );
        return createPreparedRepository(database).listPrepared(
          campaignId,
          actorUserId,
          sessionId,
        );
      });
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
      const notes = sanitizeRichText(input.notes);
      runTransaction(database, () => {
        statement(
          database,
          `INSERT INTO prepared_encounters
            (id, session_id, name, notes, sort_order, revision, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
        ).run(id, sessionId, input.name, notes, input.sortOrder, now, now);
        const combatants = parseInput(
          preparedEncounterFields.shape.combatants,
          input.combatants ?? [],
        ).map((entry) => ({ ...entry, notes: sanitizeRichText(entry.notes) }));
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
          [notes, ...combatants.map(({ notes }) => notes)].join("\n"),
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
      const notes = sanitizeRichText(input.notes);
      runTransaction(database, () => {
        const result = statement(
          database,
          `UPDATE prepared_encounters SET name = ?, notes = ?, sort_order = ?,
             revision = revision + 1, updated_at = ?
           WHERE id = ? AND revision = ? AND session_id IN
             (SELECT id FROM sessions WHERE campaign_id = ?)`,
        ).run(
          input.name,
          notes,
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
            campaignId,
          );
        const combatants = parseInput(
          preparedEncounterFields.shape.combatants,
          input.combatants ?? [],
        ).map((entry) => ({ ...entry, notes: sanitizeRichText(entry.notes) }));
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
          [notes, ...combatants.map(({ notes }) => notes)].join("\n"),
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
        const result = statement(
          database,
          `DELETE FROM prepared_encounters WHERE id = ? AND session_id IN
            (SELECT id FROM sessions WHERE campaign_id = ?)`,
        ).run(id, campaignId);
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
  };
}
function replacePreparedMonsters(
  database: DatabaseSync,
  campaignId: string,
  encounterId: string,
  monsters: PreparedMonster[],
): void {
  statement(
    database,
    "DELETE FROM prepared_encounter_monsters WHERE encounter_id = ?",
  ).run(encounterId);
  const valid = statement(
    database,
    "SELECT id FROM monsters WHERE id = ? AND campaign_id = ? LIMIT 1",
  );
  const insert = statement(
    database,
    `INSERT INTO prepared_encounter_monsters
      (id, encounter_id, monster_id, display_number, quantity, sort_order)
     VALUES (?, ?, ?, ?, ?, ?)`,
  );
  const checked = new Set<string>();
  for (const entry of monsters) {
    if (!checked.has(entry.monsterId)) {
      if (!valid.get(entry.monsterId, campaignId))
        throw new ResourceNotFoundError("monster", entry.monsterId);
      checked.add(entry.monsterId);
    }
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

function getPrepared(database: DatabaseSync, id: string): PreparedEncounter {
  const row = statement(
    database,
    `SELECT id, session_id AS sessionId, name, notes, sort_order AS sortOrder,
            revision, created_at AS createdAt, updated_at AS updatedAt
       FROM prepared_encounters WHERE id = ?`,
  ).get(id) as PreparedRow | undefined;
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
    (statement(
      database,
      `SELECT id, monster_id AS monsterId, display_number AS displayNumber,
            quantity, sort_order AS sortOrder
       FROM prepared_encounter_monsters WHERE encounter_id = ?
      ORDER BY sort_order, id`,
    ).all(row.id) as PreparedMonster[]);
  return {
    ...row,
    monsters,
    combatants:
      suppliedCombatants ??
      (statement(
        database,
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
    !statement(
      database,
      "SELECT id FROM sessions WHERE id = ? AND campaign_id = ? LIMIT 1",
    ).get(sessionId, campaignId)
  )
    throw new ResourceNotFoundError("session", sessionId);
}

function replacePreparedCombatants(
  database: DatabaseSync,
  encounterId: string,
  entries: PreparedCombatant[],
): void {
  statement(
    database,
    "DELETE FROM prepared_combatants WHERE encounter_id = ?",
  ).run(encounterId);
  const insert = statement(
    database,
    `INSERT INTO prepared_combatants
 (id,encounter_id,name,kind,notes,display_number,initiative,hit_points,maximum_hit_points,armor_class,sort_order)
 VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
  );
  for (const entry of entries)
    insert.run(
      entry.id,
      encounterId,
      entry.name,
      entry.kind,
      entry.notes,
      entry.displayNumber,
      entry.initiative,
      entry.hitPoints,
      entry.maximumHitPoints,
      entry.armorClass,
      entry.sortOrder,
    );
}
