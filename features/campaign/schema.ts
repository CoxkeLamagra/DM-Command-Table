import { z } from "zod";
import type { CampaignState } from "./types";

const identifier = z.string().min(1);
const nullableNumber = z.number().finite().nullable();

const conditionSchema = z.object({
  id: identifier,
  name: z.string(),
  remainingTurns: z.number().int().positive().nullable(),
});

const combatantSchema = z.object({
  id: identifier,
  name: z.string(),
  number: nullableNumber.optional(),
  kind: z.enum(["player", "monster", "npc"]),
  initiative: z.number().finite(),
  hp: z.number().finite(),
  maxHp: z.number().finite(),
  ac: z.number().finite(),
  conditions: z.array(conditionSchema),
  monsterId: identifier.optional(),
  campaignPlayerId: identifier.optional(),
});

const playerSchema = z.object({
  id: identifier,
  name: z.string(),
  race: z.string(),
  className: z.string(),
  level: nullableNumber,
  hp: nullableNumber,
  ac: nullableNumber,
  notes: z.string(),
});

const monsterSchema = z.object({
  id: identifier,
  name: z.string(),
  type: z.string(),
  cr: z.string(),
  ac: z.number().finite(),
  hp: z.number().finite(),
  speed: z.string(),
  stats: z.string(),
  abilities: z.string(),
  spells: z.string(),
  notes: z.string(),
  slots: z.array(z.number().int().nonnegative()),
  source: z.string().optional(),
});

const preparedMonsterSchema = z.object({
  id: identifier,
  monsterId: identifier,
  number: nullableNumber.optional(),
});

const encounterSchema = z.object({
  id: identifier,
  name: z.string(),
  monsters: z.array(preparedMonsterSchema),
});

const sessionSchema = z.object({
  id: identifier,
  title: z.string(),
  date: z.string(),
  body: z.string(),
  done: z.boolean(),
  encounters: z.array(encounterSchema),
});

const storyBeatSchema = z.object({
  id: identifier,
  title: z.string(),
  chapter: z.string(),
  details: z.string(),
  status: z.enum(["planned", "active", "happened"]),
  sessionIds: z.array(identifier),
});

export const campaignStateSchema: z.ZodType<CampaignState> = z.object({
  campaignName: z.string(),
  campaignNotes: z.string(),
  encounterName: z.string(),
  round: z.number().int().positive(),
  turn: z.number().int().nonnegative(),
  combatants: z.array(combatantSchema),
  players: z.array(playerSchema),
  monsters: z.array(monsterSchema),
  sessions: z.array(sessionSchema),
  story: z.array(storyBeatSchema),
});

export const CAMPAIGN_EXPORT_FORMAT = "dm-command-table";
export const CAMPAIGN_EXPORT_VERSION = 4;

export const campaignExportSchema = z.object({
  format: z.literal(CAMPAIGN_EXPORT_FORMAT),
  version: z.literal(CAMPAIGN_EXPORT_VERSION),
  name: z.string().min(1),
  payload: campaignStateSchema,
});

export function parseCampaignState(value: unknown): CampaignState {
  return campaignStateSchema.parse(value);
}

export function parseCampaignExport(value: unknown) {
  return campaignExportSchema.parse(value);
}
