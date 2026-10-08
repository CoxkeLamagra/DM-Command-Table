import { runTransaction } from "../../db/transaction.ts";
import type { DatabaseSync } from "node:sqlite";
import { z } from "zod";
import { createBestiaryRepository } from "./bestiary-repository.ts";
import { createV6CampaignRepository } from "./campaign-repository.ts";
import { createContentRepository } from "./content-repository.ts";
import { createEncounterRepository } from "./encounter-repository.ts";
import { apiError, apiJson, jsonBody, type V6ApiContext } from "./http.ts";
import { createMembershipRepository } from "./membership-repository.ts";
import {
  campaignCreateSchema,
  campaignUpdateSchema,
  combatSchema,
  idSchema,
  membershipSchema,
  monsterSchema,
  playerSchema,
  preparedEncounterSchema,
  revisionSchema,
  sessionSchema,
  storySchema,
  templateSchema,
} from "./schemas.ts";
import { createSupportRepository } from "./support-repository.ts";
import { sanitizeRichText } from "../security/sanitize-rich-text.ts";
import { copyV6Campaign } from "./campaign-copy.ts";
import { exportV6Campaign, importV6Campaign } from "./campaign-portable.ts";

const revisionedPlayer = playerSchema.extend({ revision: revisionSchema });
const revisionedSession = sessionSchema.extend({ revision: revisionSchema });
const revisionedStory = storySchema.extend({ revision: revisionSchema });
const revisionedMonster = monsterSchema.extend({ revision: revisionSchema });
const revisionedPrepared = preparedEncounterSchema.extend({
  revision: revisionSchema,
});

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

export async function handleV6Api(
  request: Request,
  database: DatabaseSync,
  context: V6ApiContext,
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const segments = url.pathname
      .replace(/^\/api\/v6\/?/, "")
      .split("/")
      .filter(Boolean)
      .map(decodeURIComponent);
    const method = request.method.toUpperCase();
    const campaigns = createV6CampaignRepository(database);
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

    if (segments[1] === "import" && method === "POST")
      return apiJson(
        {
          campaign: importV6Campaign(
            database,
            context.userId,
            await jsonBody(request, 10 * 1024 * 1024),
          ),
        },
        201,
      );
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
    if (resource === "export" && method === "GET")
      return apiJson(exportV6Campaign(database, campaignId, context.userId));
    if (resource === "copy" && method === "POST") {
      const input = z
        .object({ mode: z.enum(["campaign", "template"]) })
        .parse(await jsonBody(request));
      return apiJson(
        {
          campaign: copyV6Campaign(
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
              .array(revisionedPrepared.extend({ id: idSchema }))
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
      if (method === "POST" && resourceId === "undo")
        return apiJson({
          combat: encounters.undoCombat(campaignId, context.userId),
        });
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
