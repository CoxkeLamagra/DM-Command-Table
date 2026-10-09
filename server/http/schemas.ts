import { adventureSchema, continuitySchema } from "./adventure-schemas.ts";
import { MAX_COMBATANTS } from "../../domain/limits.ts";
import { z } from "zod";

export const idSchema = z.string().uuid();
export const revisionSchema = z.number().int().positive();
export const statusSchema = z.enum(["planned", "active", "happened"]);

export const campaignCreateSchema = z.object({
  name: z.string().max(120),
  notes: z.string().max(1_000_000).optional(),
});

export const campaignUpdateSchema = z.object({
  revision: revisionSchema,
  name: z.string().max(120).optional(),
  notes: z.string().max(1_000_000).optional(),
  archived: z.boolean().optional(),
  adventure: adventureSchema.optional(),
});

export const membershipSchema = z.object({
  username: z.string().trim().min(3).max(32),
  role: z.enum(["viewer", "editor"]),
});

export const playerSchema = z.object({
  kind: z.enum(["player", "npc"]).default("player"),
  name: z.string().max(120),
  race: z.string().max(120),
  className: z.string().max(120),
  level: z.number().int().positive().nullable(),
  hitPoints: z.number().int().nonnegative().nullable(),
  armorClass: z.number().int().nonnegative().nullable(),
  notes: z.string().max(1_000_000),
});

export const sessionSchema = z.object({
  continuity: continuitySchema.optional(),
  title: z.string().max(200),
  date: z.string().max(40),
  notes: z.string().max(1_000_000),
  status: statusSchema,
  sortOrder: z.number().int(),
});

export const storySchema = z.object({
  title: z.string().max(200),
  chapter: z.string().max(200),
  details: z.string().max(1_000_000),
  status: statusSchema,
  sortOrder: z.number().int(),
  sessionIds: z.array(idSchema).max(10_000),
});

export const monsterSchema = z.object({
  name: z.string().max(200),
  type: z.string().max(200),
  challengeRating: z.string().max(40),
  armorClass: z.number().int().nonnegative(),
  hitPoints: z.number().int().nonnegative(),
  speed: z.string().max(500),
  stats: z.string().max(20_000),
  abilities: z.string().max(1_000_000),
  spells: z.string().max(1_000_000),
  notes: z.string().max(1_000_000),
  spellSlots: z.array(z.number().int().nonnegative()).max(20),
  source: z.string().max(200).nullable(),
  favorite: z.boolean(),
  tagIds: z.array(idSchema).max(100).optional(),
});

export const preparedMonsterSchema = z.object({
  id: idSchema,
  monsterId: idSchema,
  displayNumber: z.number().int().positive().nullable(),
  quantity: z.number().int().positive().max(1_000),
  sortOrder: z.number().int(),
});

export const combatConditionSchema = z.object({
  id: idSchema,
  name: z.string().min(1).max(120),
  remainingTurns: z.number().int().positive().nullable(),
  timing: z.enum(["start-turn", "end-turn", "manual"]).optional(),
  requiresSave: z.boolean().default(false),
  saveDue: z.boolean().default(false),
});

export const combatRuntimeSchema = z.object({
  temporaryHitPoints: z.number().finite().nonnegative(),
  concentration: z.string().trim().min(1).max(200).nullable(),
  deathSaves: z.object({
    successes: z.number().int().min(0).max(3),
    failures: z.number().int().min(0).max(3),
  }),
  resources: z
    .array(
      z
        .object({
          id: idSchema,
          name: z.string().trim().min(1).max(120),
          maximum: z.number().int().min(0).max(10000),
          remaining: z.number().int().min(0).max(10000),
          reset: z.enum(["manual", "start-turn"]),
        })
        .refine(
          (value) => value.remaining <= value.maximum,
          "Remaining uses cannot exceed the maximum",
        ),
    )
    .max(100)
    .refine(
      (values) =>
        new Set(values.map((value) => value.id)).size === values.length,
      "Resource IDs must be unique",
    ),
});
export const combatSnapshotSchema = z.object({
  tags: z
    .array(
      z.object({
        id: z.string().max(120),
        name: z.string().max(120),
        color: z.string().max(40).nullable(),
      }),
    )
    .max(100)
    .default([]),
  name: z.string().max(200),
  type: z.string().max(200),
  challengeRating: z.string().max(40),
  speed: z.string().max(200),
  source: z.string().max(120),
  stats: z.string().max(1000000),
  abilities: z.string().max(1000000),
  spells: z.string().max(1000000),
  notes: z.string().max(1000000),
  hitPoints: z.number().finite().nonnegative(),
  armorClass: z.number().finite().nonnegative(),
  spellSlots: z.array(z.number().int().nonnegative().max(10000)).max(9),
});
export const combatantSchema = z.object({
  id: idSchema,
  playerId: idSchema.nullable(),
  monsterId: idSchema.nullable(),
  name: z.string().max(200),
  displayNumber: z.number().int().positive().nullable(),
  kind: z.enum(["player", "monster", "npc"]),
  notes: z.string().max(1_000_000).default(""),
  initiative: z.number().finite(),
  hitPoints: z.number().finite(),
  maximumHitPoints: z.number().finite().nonnegative(),
  armorClass: z.number().finite().nonnegative(),
  sortOrder: z.number().int(),
  conditions: z.array(combatConditionSchema).max(100),
  runtime: combatRuntimeSchema.optional(),
  snapshot: combatSnapshotSchema.nullable().optional(),
  revision: revisionSchema,
});

export const preparedCombatantSchema = combatantSchema.omit({
  playerId: true,
  monsterId: true,
  conditions: true,
  runtime: true,
  snapshot: true,
  revision: true,
});

export const preparedEncounterFields = z.object({
  name: z.string().max(200),
  notes: z.string().max(1_000_000),
  sortOrder: z.number().int(),
  monsters: z
    .array(preparedMonsterSchema)
    .max(MAX_COMBATANTS)
    .refine(
      (entries) =>
        entries.reduce((sum, entry) => sum + entry.quantity, 0) <=
        MAX_COMBATANTS,
      "Prepared encounters support at most 10,000 combatants.",
    ),
  combatants: z
    .array(preparedCombatantSchema)
    .max(1_000)
    .refine(
      (entries) => new Set(entries.map(({ id }) => id)).size === entries.length,
      "Combatant IDs must be unique",
    )
    .default([]),
});

export function preparedEncounterFits(input: {
  monsters: { quantity: number }[];
  combatants?: unknown[];
}): boolean {
  return (
    input.monsters.reduce((sum, entry) => sum + entry.quantity, 0) +
      (input.combatants?.length ?? 0) <=
    MAX_COMBATANTS
  );
}

export const preparedEncounterSchema = preparedEncounterFields.refine(
  preparedEncounterFits,
  "Prepared encounters support at most 10,000 combatants.",
);

export const combatSchema = z.object({
  revision: revisionSchema,
  action: z.string().min(1).max(120).optional(),
  name: z.string().max(200),
  round: z.number().int().positive(),
  turn: z.number().int().nonnegative(),
  combatants: z.array(combatantSchema).max(10_000),
});

export const templateSchema = z.object({
  id: idSchema.optional(),
  name: z.string().max(200),
  content: z.string().max(1_000_000),
});
