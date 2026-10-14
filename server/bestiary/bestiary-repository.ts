import { statement } from "../../db/statements.ts";
import { sanitizeRichText } from "../security/sanitize-rich-text.ts";
import type { DatabaseSync } from "node:sqlite";
import { runTransaction } from "../../db/transaction.ts";
import {
  requireCampaignEdit,
  requireCampaignRead,
} from "../campaigns/access.ts";
import {
  changed,
  index,
  removeIndex,
} from "../support/resource-persistence.ts";
import {
  ResourceNotFoundError,
  RevisionConflictError,
} from "../http/conflicts.ts";
import { PublicApiError } from "../http/errors.ts";
import { syncScreenshotReferences } from "../media/screenshots.ts";

import type { Monster } from "../../domain/types.ts";
export type { Monster } from "../../domain/types.ts";
export type MonsterInput = Omit<
  Monster,
  "id" | "campaignId" | "tags" | "revision" | "createdAt" | "updatedAt"
> & { tagIds?: string[] };

type MonsterRow = Omit<
  Monster,
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
    list(campaignId: string, actorUserId: string): Monster[] {
      requireCampaignRead(database, campaignId, actorUserId);
      const tagsByMonster = new Map<string, Tag[]>();
      const tagged = statement(
        database,
        `SELECT mt.monster_id AS monsterId, t.id, t.name, t.color
        FROM monster_tags mt JOIN tags t ON t.id=mt.tag_id JOIN monsters m ON m.id=mt.monster_id
        WHERE m.campaign_id=? ORDER BY t.name COLLATE NOCASE`,
      ).all(campaignId) as Array<Tag & { monsterId: string }>;
      for (const { monsterId, ...tag } of tagged) {
        const tags = tagsByMonster.get(monsterId) ?? [];
        tags.push(tag);
        tagsByMonster.set(monsterId, tags);
      }
      return (
        statement(
          database,
          `SELECT id, campaign_id AS campaignId, name, type,
                challenge_rating AS challengeRating, armor_class AS armorClass,
                hit_points AS hitPoints, speed, stats, token, abilities, spells, notes,
                spell_slots AS spellSlots, source, favorite, revision,
                created_at AS createdAt, updated_at AS updatedAt
           FROM monsters WHERE campaign_id = ? ORDER BY name COLLATE NOCASE, id`,
        ).all(campaignId) as MonsterRow[]
      ).map((row) => toMonster(database, row, tagsByMonster.get(row.id) ?? []));
    },

    create(
      campaignId: string,
      actorUserId: string,
      input: MonsterInput,
    ): Monster {
      requireCampaignEdit(database, campaignId, actorUserId);
      input = sanitizeMonster(input);
      const id = crypto.randomUUID();
      const now = Date.now();
      runTransaction(database, () => {
        statement(
          database,
          `INSERT INTO monsters
            (id, campaign_id, name, type, challenge_rating, armor_class,
             hit_points, speed, stats, token, abilities, spells, notes, spell_slots,
             source, favorite, revision, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
        ).run(
          id,
          campaignId,
          input.name,
          input.type,
          input.challengeRating,
          input.armorClass,
          input.hitPoints,
          input.speed,
          input.stats,
          input.token ?? "",
          input.abilities ?? "",
          input.spells ?? "",
          input.notes ?? "",
          JSON.stringify(input.spellSlots),
          input.source,
          input.favorite ? 1 : 0,
          now,
          now,
        );
        replaceTags(database, campaignId, id, input.tagIds ?? []);
        touch(database, campaignId, actorUserId, id, "created");
        indexMonster(database, campaignId, id, input);
        syncScreenshotReferences(
          database,
          campaignId,
          actorUserId,
          "monster",
          id,
          input.stats,
          input.token ?? "",
          input.abilities ?? "",
          input.spells ?? "",
          input.notes ?? "",
        );
      });
      return getMonster(database, id);
    },

    update(
      campaignId: string,
      actorUserId: string,
      id: string,
      expectedRevision: number,
      input: MonsterInput,
    ): Monster {
      requireCampaignEdit(database, campaignId, actorUserId);
      input = sanitizeMonster(input);
      runTransaction(database, () => {
        const result = statement(
          database,
          `UPDATE monsters SET name = ?, type = ?, challenge_rating = ?,
             armor_class = ?, hit_points = ?, speed = ?, stats = ?, token = ?, abilities = ?,
             spells = ?, notes = ?, spell_slots = ?, source = ?, favorite = ?,
             revision = revision + 1, updated_at = ?
           WHERE id = ? AND campaign_id = ? AND revision = ?`,
        ).run(
          input.name,
          input.type,
          input.challengeRating,
          input.armorClass,
          input.hitPoints,
          input.speed,
          input.stats,
          input.token ?? "",
          input.abilities ?? "",
          input.spells ?? "",
          input.notes ?? "",
          JSON.stringify(input.spellSlots),
          input.source,
          input.favorite ? 1 : 0,
          Date.now(),
          id,
          campaignId,
          expectedRevision,
        );
        if (!result.changes) {
          const actual = statement(
            database,
            "SELECT revision FROM monsters WHERE id = ? AND campaign_id = ?",
          ).get(id, campaignId) as { revision: number } | undefined;
          if (!actual) throw new ResourceNotFoundError("monster", id);
          throw new RevisionConflictError(
            "monster",
            id,
            expectedRevision,
            actual.revision,
          );
        }
        replaceTags(database, campaignId, id, input.tagIds ?? []);
        touch(database, campaignId, actorUserId, id, "updated");
        indexMonster(database, campaignId, id, input);
        syncScreenshotReferences(
          database,
          campaignId,
          actorUserId,
          "monster",
          id,
          input.stats,
          input.token ?? "",
          input.abilities ?? "",
          input.spells ?? "",
          input.notes ?? "",
        );
      });
      return getMonster(database, id);
    },

    delete(campaignId: string, actorUserId: string, id: string): void {
      requireCampaignEdit(database, campaignId, actorUserId);
      try {
        runTransaction(database, () => {
          syncScreenshotReferences(
            database,
            campaignId,
            actorUserId,
            "monster",
            id,
            "",
          );
          const result = statement(
            database,
            "DELETE FROM monsters WHERE id = ? AND campaign_id = ?",
          ).run(id, campaignId);
          if (!result.changes) throw new ResourceNotFoundError("monster", id);
          touch(database, campaignId, actorUserId, id, "deleted");
          removeIndex(database, campaignId, "monster", id);
        });
      } catch (error) {
        if (error instanceof Error && error.message.includes("FOREIGN KEY"))
          throw new PublicApiError(
            "This monster is used by a prepared encounter. Remove it from all prepared encounters before deleting it from the Bestiary.",
            409,
          );
        throw error;
      }
    },

    createTag(
      campaignId: string,
      actorUserId: string,
      input: { name: string; color?: string | null },
    ): Tag {
      requireCampaignEdit(database, campaignId, actorUserId);
      const tag = {
        id: crypto.randomUUID(),
        name: input.name.trim(),
        color: input.color ?? null,
      };
      if (!tag.name) throw new PublicApiError("A tag name is required.");
      statement(
        database,
        "INSERT INTO tags (id, campaign_id, name, color) VALUES (?, ?, ?, ?)",
      ).run(tag.id, campaignId, tag.name, tag.color);
      touch(database, campaignId, actorUserId, tag.id, "tag_created");
      return tag;
    },

    listTags(campaignId: string, actorUserId: string): Tag[] {
      requireCampaignRead(database, campaignId, actorUserId);
      return statement(
        database,
        "SELECT id, name, color FROM tags WHERE campaign_id = ? ORDER BY name COLLATE NOCASE",
      ).all(campaignId) as Tag[];
    },
  };
}

function indexMonster(
  database: DatabaseSync,
  campaignId: string,
  id: string,
  input: MonsterInput,
): void {
  index(
    database,
    campaignId,
    "monster",
    id,
    input.name,
    `${input.type} ${input.challengeRating} ${input.source ?? ""} ${input.stats} ${input.abilities} ${input.spells} ${input.notes}`,
  );
}

function replaceTags(
  database: DatabaseSync,
  campaignId: string,
  monsterId: string,
  tagIds: string[],
): void {
  statement(database, "DELETE FROM monster_tags WHERE monster_id = ?").run(
    monsterId,
  );
  const valid = statement(
    database,
    "SELECT id FROM tags WHERE id = ? AND campaign_id = ? LIMIT 1",
  );
  const insert = statement(
    database,
    "INSERT INTO monster_tags (monster_id, tag_id) VALUES (?, ?)",
  );
  for (const tagId of new Set(tagIds)) {
    if (!valid.get(tagId, campaignId))
      throw new ResourceNotFoundError("tag", tagId);
    insert.run(monsterId, tagId);
  }
}

function getMonster(database: DatabaseSync, id: string): Monster {
  const row = statement(
    database,
    `SELECT id, campaign_id AS campaignId, name, type,
            challenge_rating AS challengeRating, armor_class AS armorClass,
            hit_points AS hitPoints, speed, stats, token, abilities, spells, notes,
            spell_slots AS spellSlots, source, favorite, revision,
            created_at AS createdAt, updated_at AS updatedAt
       FROM monsters WHERE id = ?`,
  ).get(id) as MonsterRow | undefined;
  if (!row) throw new ResourceNotFoundError("monster", id);
  return toMonster(database, row);
}

function toMonster(
  database: DatabaseSync,
  row: MonsterRow,
  suppliedTags?: Tag[],
): Monster {
  const tags =
    suppliedTags ??
    (statement(
      database,
      `SELECT t.id, t.name, t.color FROM tags t
       JOIN monster_tags mt ON mt.tag_id = t.id
      WHERE mt.monster_id = ? ORDER BY t.name COLLATE NOCASE`,
    ).all(row.id) as Tag[]);
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
  changed(
    database,
    campaignId,
    actorUserId,
    action === "tag_created" ? "tag" : "monster",
    resourceId,
    action,
  );
}

function sanitizeMonster(input: MonsterInput): MonsterInput {
  return {
    ...input,
    stats: sanitizeRichText(input.stats),
    token: sanitizeRichText(input.token ?? ""),
    abilities: sanitizeRichText(input.abilities),
    spells: sanitizeRichText(input.spells),
    notes: sanitizeRichText(input.notes),
  };
}
