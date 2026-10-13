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
import type { RouteInput } from "./route-input.ts";
export async function handleCombatRoutes(
  input: RouteInput,
): Promise<Response | null> {
  const {
    request,
    database,
    context,
    campaignId,
    resource,
    resourceId,
    method,
  } = input;
  const content = createContentRepository(database);
  const bestiary = createBestiaryRepository(database);
  const encounters = createEncounterRepository(database);
  if (resource === "combat") {
    if (method === "POST" && resourceId === "command") {
      const { command, combat, zeroHpPolicy } = z
        .object({
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
        })
        .parse(await jsonBody(request));
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
    if (method === "POST" && resourceId === "load-prepared") {
      requireCampaignEdit(database, campaignId, context.userId);
      const { revision, prepared } = z
        .object({
          revision: revisionSchema,
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
        })
        .parse(await jsonBody(request));
      const sessions = content.listSessions(campaignId, context.userId);
      if (!sessions.some((session) => session.id === prepared.sessionId))
        return apiJson({ error: "Session not found" }, 404);
      const current = encounters.getCombat(campaignId, context.userId);
      const next = loadPreparation(
        current,
        prepared,
        bestiary.list(campaignId, context.userId),
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

    if (method === "GET")
      return apiJson({
        combat: encounters.getCombat(campaignId, context.userId),
      });
    if (method === "PUT") {
      const { revision, action, ...input } = combatSchema.parse(
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
    if (method === "POST" && resourceId === "undo") {
      const { revision } = z
        .object({ revision: revisionSchema })
        .parse(await jsonBody(request));
      return apiJson({
        combat: encounters.undoCombat(campaignId, context.userId, revision),
      });
    }
  }

  return null;
}
