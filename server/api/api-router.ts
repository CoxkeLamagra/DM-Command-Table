import { requireCampaignEdit } from "../campaigns/access.ts";
import {
  exportCampaignPackage,
  importCampaignPackage,
} from "../campaigns/campaign-package.ts";
import { CAMPAIGN_PACKAGE_LIMIT } from "../../domain/limits.ts";
import { applyCombatAction, loadPreparation } from "../../domain/combat.ts";
import { runTransaction } from "../../db/transaction.ts";
import type { DatabaseSync } from "node:sqlite";
import { z } from "zod";
import { createBestiaryRepository } from "../bestiary/bestiary-repository.ts";
import { createCampaignRepository } from "../campaigns/campaign-repository.ts";
import { createContentRepository } from "../content/content-repository.ts";
import { createEncounterRepository } from "../encounters/encounter-repository.ts";
import { apiError, apiJson, jsonBody, type ApiContext } from "../http/http.ts";
import { createMembershipRepository } from "../campaigns/membership-repository.ts";
import {
  campaignCreateSchema,
  campaignUpdateSchema,
  combatSchema,
  idSchema,
  membershipSchema,
  monsterSchema,
  playerSchema,
  preparedEncounterSchema,
  preparedEncounterFields,
  preparedEncounterFits,
  revisionSchema,
  sessionSchema,
  storySchema,
  templateSchema,
} from "../http/schemas.ts";
import { createSupportRepository } from "../support/support-repository.ts";
import { sanitizeRichText } from "../security/sanitize-rich-text.ts";
import { copyCampaign } from "../campaigns/campaign-copy.ts";
import {
  exportCampaign,
  importCampaign,
} from "../campaigns/campaign-portable.ts";

const revisionedPlayer = playerSchema.extend({ revision: revisionSchema });
const revisionedSession = sessionSchema.extend({ revision: revisionSchema });
const revisionedStory = storySchema.extend({ revision: revisionSchema });
const revisionedMonster = monsterSchema.extend({ revision: revisionSchema });
const revisionedPrepared = preparedEncounterFields
  .extend({
    revision: revisionSchema,
  })
  .refine(
    preparedEncounterFits,
    "Prepared encounters support at most 10,000 combatants.",
  );

function clean<T extends Record<string, unknown>>(
  input: T,
  fields: (keyof T)[],
): T {
  const result = { ...input };
  for (const field of fields) {
    const value = result[field];
    if (typeof value === "string")
      result[field] = sanitizeRichText(value) as T[keyof T];
  }
  return result;
}

export async function handleApi(
  request: Request,
  database: DatabaseSync,
  context: ApiContext,
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const segments = url.pathname
      .replace(/^\/api\/?/, "")
      .split("/")
      .filter(Boolean)
      .map(decodeURIComponent);
    const method = request.method.toUpperCase();
    const campaigns = createCampaignRepository(database);
    const memberships = createMembershipRepository(database);
    const content = createContentRepository(database);
    const bestiary = createBestiaryRepository(database);
    const encounters = createEncounterRepository(database);
    const support = createSupportRepository(database);

    if (segments[0] === "templates") {
      if (method === "GET")
        return apiJson({ templates: support.listTemplates(context.userId) });
      if (method === "POST") {
        const input = templateSchema.parse(await jsonBody(request));
        return apiJson(
          { template: support.saveTemplate(context.userId, input) },
          201,
        );
      }
      if (method === "DELETE" && segments[1]) {
        support.deleteTemplate(context.userId, idSchema.parse(segments[1]));
        return apiJson({ deleted: true });
      }
    }

    if (segments[0] !== "campaigns")
      return apiJson({ error: "API resource not found." }, 404);
    if (segments.length === 1) {
      if (method === "GET")
        return apiJson({
          campaigns: campaigns.list(context.userId, {
            archived: url.searchParams.get("archived") === "true",
          }),
        });
      if (method === "POST") {
        const input = clean(
          campaignCreateSchema.parse(await jsonBody(request)),
          ["notes"],
        );
        return apiJson(
          { campaign: campaigns.create(context.userId, input) },
          201,
        );
      }
    }

    if (segments[1] === "import" && method === "POST") {
      const value = await jsonBody(request, CAMPAIGN_PACKAGE_LIMIT);
      const isPackage =
        value &&
        typeof value === "object" &&
        "format" in value &&
        value.format === "dmct-campaign-package";
      return apiJson(
        {
          campaign: isPackage
            ? await importCampaignPackage(database, context.userId, value)
            : importCampaign(database, context.userId, value),
        },
        201,
      );
    }
    const campaignId = idSchema.parse(segments[1]);
    if (segments.length === 2) {
      if (method === "GET")
        return apiJson({ campaign: campaigns.get(campaignId, context.userId) });
      if (method === "PATCH") {
        const input = clean(
          campaignUpdateSchema.parse(await jsonBody(request)),
          ["notes"],
        );
        const { revision, ...patch } = input;
        return apiJson({
          campaign: campaigns.update(
            campaignId,
            context.userId,
            revision,
            patch,
          ),
        });
      }
      if (method === "DELETE") {
        campaigns.delete(campaignId, context.userId);
        return apiJson({ deleted: true });
      }
    }

    const resource = segments[2];
    const resourceId = segments[3];
    if (resource === "package" && method === "GET")
      return apiJson(
        await exportCampaignPackage(database, campaignId, context.userId),
      );
    if (resource === "export" && method === "GET")
      return apiJson(exportCampaign(database, campaignId, context.userId));
    if (resource === "copy" && method === "POST") {
      const input = z
        .object({ mode: z.enum(["campaign", "template"]) })
        .parse(await jsonBody(request));
      return apiJson(
        {
          campaign: copyCampaign(
            database,
            campaignId,
            context.userId,
            input.mode,
          ),
        },
        201,
      );
    }
    if (resource === "members") {
      if (method === "POST" && resourceId === "transfer") {
        const input = z
          .object({ userId: idSchema })
          .parse(await jsonBody(request));
        return apiJson({
          members: memberships.transferOwnership(
            campaignId,
            context.userId,
            input.userId,
          ),
        });
      }
      if (method === "GET")
        return apiJson({
          members: memberships.list(campaignId, context.userId),
        });
      if (method === "POST") {
        const input = membershipSchema.parse(await jsonBody(request));
        return apiJson({
          members: memberships.grant(
            campaignId,
            context.userId,
            input.username,
            input.role,
          ),
        });
      }
      if (method === "DELETE" && resourceId) {
        return apiJson({
          members: memberships.revoke(campaignId, context.userId, resourceId),
        });
      }
    }

    if (
      (resource === "players" || resource === "monsters") &&
      resourceId === "bulk-delete" &&
      method === "POST"
    ) {
      const { ids } = z
        .object({ ids: z.array(idSchema).min(1).max(1000) })
        .parse(await jsonBody(request));
      runTransaction(database, () => {
        for (const id of new Set(ids)) {
          if (resource === "players")
            content.deletePlayer(campaignId, context.userId, id);
          else bestiary.delete(campaignId, context.userId, id);
        }
      });
      return apiJson({ deleted: ids });
    }
    if (resource === "players") {
      if (method === "GET")
        return apiJson({
          players: content.listPlayers(campaignId, context.userId),
        });
      if (method === "POST") {
        const input = clean(playerSchema.parse(await jsonBody(request)), [
          "notes",
        ]);
        return apiJson(
          { player: content.createPlayer(campaignId, context.userId, input) },
          201,
        );
      }
      if (resourceId && method === "PATCH") {
        const { revision, ...input } = clean(
          revisionedPlayer.parse(await jsonBody(request)),
          ["notes"],
        );
        return apiJson({
          player: content.updatePlayer(
            campaignId,
            context.userId,
            resourceId,
            revision,
            input,
          ),
        });
      }
      if (resourceId && method === "DELETE") {
        content.deletePlayer(campaignId, context.userId, resourceId);
        return apiJson({ deleted: true });
      }
    }

    if (resource === "sessions") {
      if (resourceId && segments[4] === "save" && method === "POST") {
        const input = z
          .object({
            session: revisionedSession,
            encounters: z
              .array(
                preparedEncounterFields
                  .extend({ revision: revisionSchema, id: idSchema })
                  .refine(
                    preparedEncounterFits,
                    "Prepared encounters support at most 10,000 combatants.",
                  ),
              )
              .max(500),
          })
          .parse(await jsonBody(request));
        const result = runTransaction(database, () => {
          const allowed = new Set(
            encounters
              .listPrepared(campaignId, context.userId, resourceId)
              .map(({ id }) => id),
          );
          const seen = new Set<string>();
          const savedEncounters = input.encounters.map(
            ({ id, revision, ...values }) => {
              if (!allowed.has(id) || seen.has(id))
                throw new z.ZodError([
                  {
                    code: "custom",
                    path: ["encounters"],
                    message: "Invalid encounter selection",
                  },
                ]);
              seen.add(id);
              return encounters.updatePrepared(
                campaignId,
                context.userId,
                id,
                revision,
                clean(values, ["notes"]),
              );
            },
          );
          const { revision, ...values } = clean(input.session, ["notes"]);
          const session = content.updateSession(
            campaignId,
            context.userId,
            resourceId,
            revision,
            values,
          );
          return { session, encounters: savedEncounters };
        });
        return apiJson(result);
      }

      if (resourceId && segments[4] === "encounters") {
        const encounterId = segments[5];
        if (method === "GET")
          return apiJson({
            encounters: encounters.listPrepared(
              campaignId,
              context.userId,
              resourceId,
            ),
          });
        if (method === "POST") {
          const input = clean(
            preparedEncounterSchema.parse(await jsonBody(request)),
            ["notes"],
          );
          return apiJson(
            {
              encounter: encounters.createPrepared(
                campaignId,
                context.userId,
                resourceId,
                input,
              ),
            },
            201,
          );
        }
        if (encounterId && method === "PATCH") {
          const { revision, ...input } = clean(
            revisionedPrepared.parse(await jsonBody(request)),
            ["notes"],
          );
          return apiJson({
            encounter: encounters.updatePrepared(
              campaignId,
              context.userId,
              encounterId,
              revision,
              input,
            ),
          });
        }
        if (encounterId && method === "DELETE") {
          encounters.deletePrepared(campaignId, context.userId, encounterId);
          return apiJson({ deleted: true });
        }
      }
      if (method === "GET")
        return apiJson({
          sessions: content.listSessions(campaignId, context.userId),
        });
      if (method === "POST") {
        const input = clean(sessionSchema.parse(await jsonBody(request)), [
          "notes",
        ]);
        return apiJson(
          { session: content.createSession(campaignId, context.userId, input) },
          201,
        );
      }
      if (resourceId && method === "PATCH") {
        const { revision, ...input } = clean(
          revisionedSession.parse(await jsonBody(request)),
          ["notes"],
        );
        return apiJson({
          session: content.updateSession(
            campaignId,
            context.userId,
            resourceId,
            revision,
            input,
          ),
        });
      }
      if (resourceId && method === "DELETE") {
        content.deleteSession(campaignId, context.userId, resourceId);
        return apiJson({ deleted: true });
      }
    }

    if (resource === "story") {
      if (method === "GET")
        return apiJson({
          story: content.listStory(campaignId, context.userId),
        });
      if (method === "POST") {
        const input = clean(storySchema.parse(await jsonBody(request)), [
          "details",
        ]);
        return apiJson(
          { beat: content.createStoryBeat(campaignId, context.userId, input) },
          201,
        );
      }
      if (resourceId && method === "PATCH") {
        const { revision, ...input } = clean(
          revisionedStory.parse(await jsonBody(request)),
          ["details"],
        );
        return apiJson({
          beat: content.updateStoryBeat(
            campaignId,
            context.userId,
            resourceId,
            revision,
            input,
          ),
        });
      }
      if (resourceId && method === "DELETE") {
        content.deleteStoryBeat(campaignId, context.userId, resourceId);
        return apiJson({ deleted: true });
      }
    }

    if (resource === "monsters") {
      if (method === "GET")
        return apiJson({ monsters: bestiary.list(campaignId, context.userId) });
      if (method === "POST") {
        const input = clean(monsterSchema.parse(await jsonBody(request)), [
          "abilities",
          "spells",
          "notes",
        ]);
        return apiJson(
          { monster: bestiary.create(campaignId, context.userId, input) },
          201,
        );
      }
      if (resourceId && method === "PATCH") {
        const { revision, ...input } = clean(
          revisionedMonster.parse(await jsonBody(request)),
          ["abilities", "spells", "notes"],
        );
        return apiJson({
          monster: bestiary.update(
            campaignId,
            context.userId,
            resourceId,
            revision,
            input,
          ),
        });
      }
      if (resourceId && method === "DELETE") {
        bestiary.delete(campaignId, context.userId, resourceId);
        return apiJson({ deleted: true });
      }
    }

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

    if (resource === "search" && method === "GET") {
      return apiJson({
        results: support.search(
          campaignId,
          context.userId,
          url.searchParams.get("q") ?? "",
          100,
          z
            .enum(["all", "session", "story", "player", "npc", "monster"])
            .parse(url.searchParams.get("type") ?? "all"),
        ),
      });
    }

    return apiJson({ error: "API resource not found." }, 404);
  } catch (error) {
    return apiError(error);
  }
}
