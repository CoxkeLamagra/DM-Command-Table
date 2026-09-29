import type { DatabaseSync } from "node:sqlite";
import { runTransaction } from "../../db/transaction.ts";
import { requireCampaignEdit, requireCampaignRead } from "./access.ts";
import { recordAuditEvent } from "./audit.ts";
import { ResourceNotFoundError, RevisionConflictError } from "./conflicts.ts";
import { PublicApiError } from "./errors.ts";

export type V6Monster = {
  id: string;
  campaignId: string;
  name: string;
  type: string;
  challengeRating: string;
  armorClass: number;
  hitPoints: number;
  speed: string;
  stats: string;
  abilities: string;
  spells: string;
  notes: string;
  spellSlots: number[];
  source: string | null;
  favorite: boolean;
  tags: Array<{ id: string; name: string; color: string | null }>;
  revision: number;
  createdAt: string;
  updatedAt: string;
};

export type MonsterInput = Omit<
  V6Monster,
  "id" | "campaignId" | "tags" | "revision" | "createdAt" | "updatedAt"
> & { tagIds?: string[] };

type MonsterRow = Omit<
  V6Monster,
  "spellSlots" | "favorite" | "tags" | "createdAt" | "updatedAt"
> & {
  spellSlots: string;
  favorite: number;
  createdAt: number;
  updatedAt: number;
};

type Tag = { id: string; name: string; color: string | null };

export function createBestiaryRepository(database: DatabaseSync) {
  return {
    list(campaignId: string, actorUserId: string): V6Monster[] {
      requireCampaignRead(database, campaignId, actorUserId);
      return (database.prepare(
        `SELECT id, campaign_id AS campaignId, name, type,
                challenge_rating AS challengeRating, armor_class AS armorClass,
                hit_points AS hitPoints, speed, stats, abilities, spells, notes,
                spell_slots AS spellSlots, source, favorite, revision,
                created_at AS createdAt, updated_at AS updatedAt
           FROM monsters WHERE campaign_id = ? ORDER BY name COLLATE NOCASE, id`,
      ).all(campaignId) as MonsterRow[]).map((row) => toMonster(database, row));
    },

    create(campaignId: string, actorUserId: string, input: MonsterInput): V6Monster {
      requireCampaignEdit(database, campaignId, actorUserId);
      const id = crypto.randomUUID();
      const now = Date.now();
      runTransaction(database, () => {
        database.prepare(
          `INSERT INTO monsters
            (id, campaign_id, name, type, challenge_rating, armor_class,
             hit_points, speed, stats, abilities, spells, notes, spell_slots,
             source, favorite, revision, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
        ).run(
          id, campaignId, input.name, input.type, input.challengeRating,
          input.armorClass, input.hitPoints, input.speed, input.stats,
          input.abilities, input.spells, input.notes, JSON.stringify(input.spellSlots),
          input.source, input.favorite ? 1 : 0, now, now,
        );
        replaceTags(database, campaignId, id, input.tagIds ?? []);
        touch(database, campaignId, actorUserId, id, "created");
      });
      indexMonster(database, campaignId, id, input);
      return getMonster(database, id);
    },

    update(
      campaignId: string,
      actorUserId: string,
      id: string,
      expectedRevision: number,
      input: MonsterInput,
    ): V6Monster {
      requireCampaignEdit(database, campaignId, actorUserId);
      runTransaction(database, () => {
        const result = database.prepare(
          `UPDATE monsters SET name = ?, type = ?, challenge_rating = ?,
             armor_class = ?, hit_points = ?, speed = ?, stats = ?, abilities = ?,
             spells = ?, notes = ?, spell_slots = ?, source = ?, favorite = ?,
             revision = revision + 1, updated_at = ?
           WHERE id = ? AND campaign_id = ? AND revision = ?`,
        ).run(
          input.name, input.type, input.challengeRating, input.armorClass,
          input.hitPoints, input.speed, input.stats, input.abilities, input.spells,
          input.notes, JSON.stringify(input.spellSlots), input.source,
          input.favorite ? 1 : 0, Date.now(), id, campaignId, expectedRevision,
        );
        if (!result.changes) {
          const actual = database.prepare(
            "SELECT revision FROM monsters WHERE id = ? AND campaign_id = ?",
          ).get(id, campaignId) as { revision: number } | undefined;
          if (!actual) throw new ResourceNotFoundError("monster", id);
          throw new RevisionConflictError("monster", id, expectedRevision, actual.revision);
        }
        replaceTags(database, campaignId, id, input.tagIds ?? []);
        touch(database, campaignId, actorUserId, id, "updated");
      });
      indexMonster(database, campaignId, id, input);
      return getMonster(database, id);
    },

    delete(campaignId: string, actorUserId: string, id: string): void {
      requireCampaignEdit(database, campaignId, actorUserId);
      try {
        const result = database.prepare(
          "DELETE FROM monsters WHERE id = ? AND campaign_id = ?",
        ).run(id, campaignId);
        if (!result.changes) throw new ResourceNotFoundError("monster", id);
      } catch (error) {
        if (error instanceof Error && error.message.includes("FOREIGN KEY"))
          throw new PublicApiError("This monster is used by a prepared encounter.", 409);
        throw error;
      }
      touch(database, campaignId, actorUserId, id, "deleted");
      database.prepare("DELETE FROM search_index WHERE campaign_id=? AND resource_type='monster' AND resource_id=?").run(campaignId,id);
    },

    createTag(
      campaignId: string,
      actorUserId: string,
      input: { name: string; color?: string | null },
    ): Tag {
      requireCampaignEdit(database, campaignId, actorUserId);
      const tag = { id: crypto.randomUUID(), name: input.name.trim(), color: input.color ?? null };
      if (!tag.name) throw new PublicApiError("A tag name is required.");
      database.prepare(
        "INSERT INTO tags (id, campaign_id, name, color) VALUES (?, ?, ?, ?)",
      ).run(tag.id, campaignId, tag.name, tag.color);
      touch(database, campaignId, actorUserId, tag.id, "tag_created");
      return tag;
    },

    listTags(campaignId: string, actorUserId: string): Tag[] {
      requireCampaignRead(database, campaignId, actorUserId);
      return database.prepare(
        "SELECT id, name, color FROM tags WHERE campaign_id = ? ORDER BY name COLLATE NOCASE",
      ).all(campaignId) as Tag[];
    },
  };
}

function indexMonster(database: DatabaseSync, campaignId: string, id: string, input: MonsterInput): void {
  database.prepare("DELETE FROM search_index WHERE campaign_id = ? AND resource_type = 'monster' AND resource_id = ?").run(campaignId, id);
  database.prepare("INSERT INTO search_index (campaign_id, resource_type, resource_id, title, content) VALUES (?, 'monster', ?, ?, ?)").run(
    campaignId, id, input.name,
    `${input.type} ${input.challengeRating} ${input.source ?? ""} ${input.stats} ${input.abilities} ${input.spells} ${input.notes}`,
  );
}

function replaceTags(
  database: DatabaseSync,
  campaignId: string,
  monsterId: string,
  tagIds: string[],
): void {
  database.prepare("DELETE FROM monster_tags WHERE monster_id = ?").run(monsterId);
  const valid = database.prepare(
    "SELECT id FROM tags WHERE id = ? AND campaign_id = ? LIMIT 1",
  );
  const insert = database.prepare(
    "INSERT INTO monster_tags (monster_id, tag_id) VALUES (?, ?)",
  );
  for (const tagId of new Set(tagIds)) {
    if (!valid.get(tagId, campaignId)) throw new ResourceNotFoundError("tag", tagId);
    insert.run(monsterId, tagId);
  }
}

function getMonster(database: DatabaseSync, id: string): V6Monster {
  const row = database.prepare(
    `SELECT id, campaign_id AS campaignId, name, type,
            challenge_rating AS challengeRating, armor_class AS armorClass,
            hit_points AS hitPoints, speed, stats, abilities, spells, notes,
            spell_slots AS spellSlots, source, favorite, revision,
            created_at AS createdAt, updated_at AS updatedAt
       FROM monsters WHERE id = ?`,
  ).get(id) as MonsterRow | undefined;
  if (!row) throw new ResourceNotFoundError("monster", id);
  return toMonster(database, row);
}

function toMonster(database: DatabaseSync, row: MonsterRow): V6Monster {
  const tags = database.prepare(
    `SELECT t.id, t.name, t.color FROM tags t
       JOIN monster_tags mt ON mt.tag_id = t.id
      WHERE mt.monster_id = ? ORDER BY t.name COLLATE NOCASE`,
  ).all(row.id) as Tag[];
  return {
    ...row,
    spellSlots: JSON.parse(row.spellSlots) as number[],
    favorite: Boolean(row.favorite),
    tags,
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString(),
  };
}

function touch(
  database: DatabaseSync,
  campaignId: string,
  actorUserId: string,
  resourceId: string,
  action: string,
): void {
  database.prepare(
    "UPDATE campaigns SET revision = revision + 1, updated_at = ? WHERE id = ?",
  ).run(Date.now(), campaignId);
  recordAuditEvent(database, {
    campaignId,
    actorUserId,
    resourceType: action === "tag_created" ? "tag" : "monster",
    resourceId,
    action,
  });
}
