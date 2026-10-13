import { runTransaction } from "../../db/transaction.ts";
import { z } from "zod";
import { createBestiaryRepository } from "../bestiary/bestiary-repository.ts";
import { createContentRepository } from "../content/content-repository.ts";
import { createEncounterRepository } from "../encounters/encounter-repository.ts";
import { apiJson, jsonBody } from "../http/http.ts";
import {
  idSchema,
  playerSchema,
  preparedEncounterSchema,
  preparedEncounterFields,
  preparedEncounterFits,
  revisionSchema,
  sessionSchema,
  storySchema,
} from "../http/schemas.ts";
import {
  revisionedPlayer,
  revisionedSession,
  revisionedStory,
  revisionedPrepared,
  clean,
} from "./route-schemas.ts";
import type { RouteInput } from "./route-input.ts";
export async function handleContentRoutes(
  input: RouteInput,
): Promise<Response | null> {
  const {
    request,
    database,
    context,
    campaignId,
    resource,
    resourceId,
    segments,
    method,
  } = input;
  const content = createContentRepository(database);
  const bestiary = createBestiaryRepository(database);
  const encounters = createEncounterRepository(database);
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

  return null;
}
