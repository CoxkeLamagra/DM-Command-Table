import type { DatabaseSync } from "node:sqlite";
import { z } from "zod";
import { runTransaction } from "../../db/transaction.ts";
import { createBestiaryRepository } from "../bestiary/bestiary-repository.ts";
import { createCampaignRepository } from "./campaign-repository.ts";
import { createContentRepository } from "../content/content-repository.ts";
import { createEncounterRepository } from "../encounters/encounter-repository.ts";
import {
  combatantSchema,
  idSchema,
  monsterSchema,
  playerSchema,
  preparedEncounterFields,
  preparedEncounterFits,
  sessionSchema,
  storySchema,
} from "../http/schemas.ts";
import { sanitizeRichText } from "../security/sanitize-rich-text.ts";
import { PublicApiError } from "../http/errors.ts";

const metadata = {
  revision: z.number().int().positive().optional(),
  createdAt: z.string().max(80).optional(),
  updatedAt: z.string().max(80).optional(),
};
const tagExportSchema = z.object({
  id: idSchema,
  name: z.string().trim().min(1).max(120),
  color: z
    .string()
    .regex(/^#[0-9a-f]{3,8}$/i)
    .nullable(),
});
const monsterExportSchema = monsterSchema.extend({
  id: idSchema,
  tags: z.array(tagExportSchema).max(100),
  ...metadata,
});
const playerExportSchema = playerSchema.extend({ id: idSchema, ...metadata });
const preparedExportSchema = preparedEncounterFields
  .extend({
    id: idSchema,
    sessionId: idSchema.optional(),
    ...metadata,
  })
  .refine(
    preparedEncounterFits,
    "Prepared encounters support at most 10,000 combatants.",
  );
const sessionExportSchema = sessionSchema.extend({
  id: idSchema,
  encounters: z.array(preparedExportSchema).max(500).default([]),
  ...metadata,
});
const storyExportSchema = storySchema.extend({ id: idSchema, ...metadata });
const combatExportSchema = z
  .object({
    id: idSchema.optional(),
    name: z.string().max(200),
    round: z.number().int().positive(),
    turn: z.number().int().nonnegative(),
    combatants: z.array(combatantSchema).max(10_000),
    ...metadata,
  })
  .nullable()
  .optional();
const portableCampaignSchema = z
  .object({
    format: z.literal("dm-command-table"),
    version: z.literal(1),
    exportedAt: z.string().max(80),
    campaign: z.object({
      name: z.string().trim().min(1).max(120),
      notes: z.string().max(1_000_000),
    }),
    tags: z.array(tagExportSchema).max(500),
    monsters: z.array(monsterExportSchema).max(5_000),
    players: z.array(playerExportSchema).max(1_000),
    sessions: z.array(sessionExportSchema).max(2_000),
    story: z.array(storyExportSchema).max(5_000),
    combat: combatExportSchema,
  })
  .superRefine((value, context) => {
    const unique = (ids: string[], label: string) => {
      if (new Set(ids).size !== ids.length)
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate ${label} IDs`,
        });
    };
    unique(
      value.players.map((x) => x.id),
      "character",
    );
    unique(
      value.monsters.map((x) => x.id),
      "monster",
    );
    unique(
      value.sessions.map((x) => x.id),
      "session",
    );
    unique(
      value.story.map((x) => x.id),
      "story",
    );
    const monsters = new Set(value.monsters.map((x) => x.id)),
      players = new Set(value.players.map((x) => x.id)),
      sessions = new Set(value.sessions.map((x) => x.id)),
      tags = new Set(value.tags.map((x) => x.id));
    const invalid =
      value.sessions.some((session) =>
        session.encounters.some((encounter) =>
          encounter.monsters.some((x) => !monsters.has(x.monsterId)),
        ),
      ) ||
      value.story.some((x) => x.sessionIds.some((id) => !sessions.has(id))) ||
      value.monsters.some((x) => x.tags.some((t) => !tags.has(t.id))) ||
      value.combat?.combatants.some(
        (x) =>
          (x.playerId && !players.has(x.playerId)) ||
          (x.monsterId && !monsters.has(x.monsterId)),
      );
    if (invalid)
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Campaign contains broken relationships",
      });
    const encounters = value.sessions.reduce(
      (sum, session) => sum + session.encounters.length,
      0,
    );
    const preparedMonsters = value.sessions.reduce(
      (sum, session) =>
        sum +
        session.encounters.reduce(
          (inner, encounter) =>
            inner + encounter.monsters.length + encounter.combatants.length,
          0,
        ),
      0,
    );
    const records =
      value.tags.length +
      value.monsters.length +
      value.players.length +
      value.sessions.length +
      value.story.length +
      encounters +
      preparedMonsters +
      (value.combat?.combatants.length ?? 0);
    if (records > 20_000)
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "The campaign export contains too many records.",
      });
  });

export function exportCampaign(
  database: DatabaseSync,
  campaignId: string,
  actorId: string,
) {
  const campaign = createCampaignRepository(database).get(campaignId, actorId);
  if (!campaign) throw new PublicApiError("Campaign not found.", 404);
  const content = createContentRepository(database);
  const bestiary = createBestiaryRepository(database);
  const encounters = createEncounterRepository(database);
  const sessions = content.listSessions(campaignId, actorId);
  return {
    format: "dm-command-table" as const,
    version: 1 as const,
    exportedAt: new Date().toISOString(),
    campaign: { name: campaign.name, notes: campaign.notes },
    tags: bestiary.listTags(campaignId, actorId),
    monsters: bestiary.list(campaignId, actorId),
    players: content.listPlayers(campaignId, actorId),
    sessions: sessions.map((session) => ({
      ...session,
      encounters: encounters.listPrepared(campaignId, actorId, session.id),
    })),
    story: content.listStory(campaignId, actorId),
    combat: encounters.getCombat(campaignId, actorId),
  };
}

export function importCampaign(
  database: DatabaseSync,
  actorId: string,
  value: unknown,
) {
  const parsed = portableCampaignSchema.safeParse(value);
  if (!parsed.success)
    throw new PublicApiError(
      "This is not a valid supported current campaign export.",
    );
  const data = parsed.data;

  return runTransaction(database, () => {
    const campaigns = createCampaignRepository(database);
    const content = createContentRepository(database);
    const bestiary = createBestiaryRepository(database);
    const encounters = createEncounterRepository(database);
    const target = campaigns.create(actorId, {
      name: `${data.campaign.name.slice(0, 109)} — Imported`,
      notes: sanitizeRichText(data.campaign.notes),
    });
    const tagIds = new Map<string, string>();
    for (const tag of data.tags) {
      const created = bestiary.createTag(target.id, actorId, {
        name: tag.name,
        color: tag.color,
      });
      tagIds.set(tag.id, created.id);
    }

    const monsterIds = new Map<string, string>();
    for (const monster of data.monsters) {
      const created = bestiary.create(target.id, actorId, {
        ...monster,
        abilities: sanitizeRichText(monster.abilities),
        spells: sanitizeRichText(monster.spells),
        notes: sanitizeRichText(monster.notes),
        tagIds: monster.tags.flatMap(({ id }) => tagIds.get(id) ?? []),
      });
      monsterIds.set(monster.id, created.id);
    }

    const playerIds = new Map<string, string>();
    for (const player of data.players) {
      const created = content.createPlayer(target.id, actorId, {
        ...player,
        notes: sanitizeRichText(player.notes),
      });
      playerIds.set(player.id, created.id);
    }

    const sessionIds = new Map<string, string>();
    for (const session of data.sessions) {
      const created = content.createSession(target.id, actorId, {
        ...session,
        notes: sanitizeRichText(session.notes),
      });
      sessionIds.set(session.id, created.id);
      for (const encounter of session.encounters) {
        encounters.createPrepared(target.id, actorId, created.id, {
          ...encounter,
          notes: sanitizeRichText(encounter.notes),
          combatants: encounter.combatants.map((entry) => ({
            ...entry,
            id: crypto.randomUUID(),
            playerId: null,
            monsterId: null,
            notes: sanitizeRichText(entry.notes),
          })),
          monsters: encounter.monsters.flatMap((entry) => {
            const monsterId = monsterIds.get(entry.monsterId);
            return monsterId
              ? [{ ...entry, id: crypto.randomUUID(), monsterId }]
              : [];
          }),
        });
      }
    }

    for (const beat of data.story) {
      content.createStoryBeat(target.id, actorId, {
        ...beat,
        details: sanitizeRichText(beat.details),
        sessionIds: beat.sessionIds.flatMap((id) => sessionIds.get(id) ?? []),
      });
    }

    if (data.combat) {
      const initial = encounters.getCombat(target.id, actorId);
      encounters.saveCombat(
        target.id,
        actorId,
        initial.revision,
        {
          ...data.combat,
          combatants: data.combat.combatants.map((entry) => ({
            ...entry,
            id: crypto.randomUUID(),
            notes: sanitizeRichText(entry.notes),
            playerId: entry.playerId
              ? (playerIds.get(entry.playerId) ?? null)
              : null,
            monsterId: entry.monsterId
              ? (monsterIds.get(entry.monsterId) ?? null)
              : null,
            conditions: entry.conditions.map((condition) => ({
              ...condition,
              id: crypto.randomUUID(),
            })),
          })),
        },
        "campaign_imported",
      );
    }
    return campaigns.get(target.id, actorId)!;
  });
}
