import { assertMonsterReadBudget } from "../bestiary/read-budget.ts";
import { parseInput } from "../http/validation.ts";
import { requireCampaignEdit } from "../campaigns/access.ts";
import { applyCombatAction, loadPreparation } from "../../domain/combat.ts";
import { z } from "zod";
import { createBestiaryRepository } from "../bestiary/bestiary-repository.ts";
import { createContentRepository } from "../content/content-repository.ts";
import { createEncounterRepository } from "../encounters/encounter-repository.ts";
import { apiJson, jsonBody } from "../http/http.ts";
import {
  combatSchema,
  idSchema,
  preparedEncounterFields,
  preparedEncounterFits,
  revisionSchema,
} from "../http/schemas.ts";
import type { RouteInput } from "./route-table.ts";
export async function combatCommand({
  request,
  database,
  context,
  campaignId,
}: RouteInput) {
  const encounters = createEncounterRepository(database);
  const { command, combat, zeroHpPolicy } = parseInput(
    z.object({
      command: z.enum([
        "next-turn",
        "reset-rounds",
        "remove-monsters",
        "clear",
      ]),
      combat: combatSchema,
      zeroHpPolicy: z
        .enum(["skip-all", "include-players", "include-all"])
        .default("skip-all"),
    }),
    await jsonBody(request),
  );
  return apiJson({
    combat: encounters.saveCombat(
      campaignId,
      context.userId,
      combat.revision,
      applyCombatAction(
        { ...combat, id: "", campaignId, createdAt: "", updatedAt: "" },
        command,
        zeroHpPolicy,
      ),
      command,
    ),
  });
}

export async function loadPreparedEncounter({
  request,
  database,
  context,
  campaignId,
}: RouteInput) {
  const content = createContentRepository(database);
  const bestiary = createBestiaryRepository(database);
  const encounters = createEncounterRepository(database);
  requireCampaignEdit(database, campaignId, context.userId);
  const { revision, prepared, preservePlayersAndNpcs } = parseInput(
    z.object({
      revision: revisionSchema,
      preservePlayersAndNpcs: z.boolean().default(false),
      prepared: preparedEncounterFields
        .extend({
          id: idSchema,
          sessionId: idSchema,
          revision: revisionSchema,
          createdAt: z.string(),
          updatedAt: z.string(),
        })
        .refine(
          preparedEncounterFits,
          "Prepared encounters support at most 10,000 combatants.",
        ),
    }),
    await jsonBody(request),
  );
  const sessions = content.listSessions(campaignId, context.userId);
  if (!sessions.some((session) => session.id === prepared.sessionId))
    return apiJson({ error: "Session not found" }, 404);
  const current = encounters.getCombat(campaignId, context.userId);
  const quantities = new Map<string, number>();
  for (const entry of prepared.monsters)
    quantities.set(
      entry.monsterId,
      (quantities.get(entry.monsterId) ?? 0) + entry.quantity,
    );
  assertMonsterReadBudget(
    database,
    campaignId,
    [...quantities.keys()],
    quantities,
  );
  const next = loadPreparation(
    current,
    prepared,
    bestiary.list(campaignId, context.userId, [...quantities.keys()]),
    undefined,
    preservePlayersAndNpcs,
  );
  return apiJson({
    combat: encounters.saveCombat(
      campaignId,
      context.userId,
      revision,
      next,
      "prepared_encounter_loaded",
    ),
  });
}

export function getCombat({ database, context, campaignId }: RouteInput) {
  return apiJson({
    combat: createEncounterRepository(database).getCombat(
      campaignId,
      context.userId,
    ),
  });
}

export async function saveCombat({
  request,
  database,
  context,
  campaignId,
}: RouteInput) {
  const encounters = createEncounterRepository(database);
  const { revision, action, ...input } = parseInput(
    combatSchema,
    await jsonBody(request),
  );
  return apiJson({
    combat: encounters.saveCombat(
      campaignId,
      context.userId,
      revision,
      input,
      action,
    ),
  });
}

export async function undoCombat({
  request,
  database,
  context,
  campaignId,
}: RouteInput) {
  const encounters = createEncounterRepository(database);
  const { revision } = parseInput(
    z.object({ revision: revisionSchema }),
    await jsonBody(request),
  );
  return apiJson({
    combat: encounters.undoCombat(campaignId, context.userId, revision),
  });
}
