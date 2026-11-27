import { parseInput } from "../http/validation.ts";
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
import type { RouteInput } from "./route-table.ts";

export function bulkDelete(resource: "players" | "monsters") {
  return async ({ request, database, context, campaignId }: RouteInput) => {
    const { ids } = parseInput(
      z.object({ ids: z.array(idSchema).min(1).max(1000) }),
      await jsonBody(request),
    );
    const content = createContentRepository(database);
    const bestiary = createBestiaryRepository(database);
    runTransaction(database, () => {
      for (const id of new Set(ids)) {
        if (resource === "players")
          content.deletePlayer(campaignId, context.userId, id);
        else bestiary.delete(campaignId, context.userId, id);
      }
    });
    return apiJson({ deleted: ids });
  };
}

// Players and NPCs

export function listPlayers({ database, context, campaignId }: RouteInput) {
  return apiJson({
    players: createContentRepository(database).listPlayers(
      campaignId,
      context.userId,
    ),
  });
}

export async function createPlayer({
  request,
  database,
  context,
  campaignId,
}: RouteInput) {
  const input = clean(parseInput(playerSchema, await jsonBody(request)), [
    "notes",
  ]);
  return apiJson(
    {
      player: createContentRepository(database).createPlayer(
        campaignId,
        context.userId,
        input,
      ),
    },
    201,
  );
}

export async function updatePlayer({
  request,
  database,
  context,
  campaignId,
  params,
}: RouteInput) {
  const { revision, ...input } = clean(
    parseInput(revisionedPlayer, await jsonBody(request)),
    ["notes"],
  );
  return apiJson({
    player: createContentRepository(database).updatePlayer(
      campaignId,
      context.userId,
      params.id,
      revision,
      input,
    ),
  });
}

export function deletePlayer({
  database,
  context,
  campaignId,
  params,
}: RouteInput) {
  createContentRepository(database).deletePlayer(
    campaignId,
    context.userId,
    params.id,
  );
  return apiJson({ deleted: true });
}

// Sessions

export function listSessions({ database, context, campaignId }: RouteInput) {
  return apiJson({
    sessions: createContentRepository(database).listSessions(
      campaignId,
      context.userId,
    ),
  });
}

export async function createSession({
  request,
  database,
  context,
  campaignId,
}: RouteInput) {
  const input = clean(parseInput(sessionSchema, await jsonBody(request)), [
    "notes",
  ]);
  return apiJson(
    {
      session: createContentRepository(database).createSession(
        campaignId,
        context.userId,
        input,
      ),
    },
    201,
  );
}

export async function updateSession({
  request,
  database,
  context,
  campaignId,
  params,
}: RouteInput) {
  const { revision, ...input } = clean(
    parseInput(revisionedSession, await jsonBody(request)),
    ["notes"],
  );
  return apiJson({
    session: createContentRepository(database).updateSession(
      campaignId,
      context.userId,
      params.sessionId,
      revision,
      input,
    ),
  });
}

export function deleteSession({
  database,
  context,
  campaignId,
  params,
}: RouteInput) {
  createContentRepository(database).deleteSession(
    campaignId,
    context.userId,
    params.sessionId,
  );
  return apiJson({ deleted: true });
}

/** Saves a session and its prepared encounters in one transaction. */
export async function saveSessionWithEncounters({
  request,
  database,
  context,
  campaignId,
  params,
}: RouteInput) {
  const sessionId = params.sessionId;
  const content = createContentRepository(database);
  const encounters = createEncounterRepository(database);
  const input = parseInput(
    z.object({
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
    }),
    await jsonBody(request),
  );
  const result = runTransaction(database, () => {
    const allowed = new Set(
      encounters
        .listPrepared(campaignId, context.userId, sessionId)
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
          values,
        );
      },
    );
    const { revision, ...values } = clean(input.session, ["notes"]);
    const session = content.updateSession(
      campaignId,
      context.userId,
      sessionId,
      revision,
      values,
    );
    return { session, encounters: savedEncounters };
  });
  return apiJson(result);
}

// Prepared encounters of a session

export function listEncounters({
  database,
  context,
  campaignId,
  params,
}: RouteInput) {
  return apiJson({
    encounters: createEncounterRepository(database).listPrepared(
      campaignId,
      context.userId,
      params.sessionId,
    ),
  });
}

export async function createEncounter({
  request,
  database,
  context,
  campaignId,
  params,
}: RouteInput) {
  const input = parseInput(preparedEncounterSchema, await jsonBody(request));
  return apiJson(
    {
      encounter: createEncounterRepository(database).createPrepared(
        campaignId,
        context.userId,
        params.sessionId,
        input,
      ),
    },
    201,
  );
}

export async function reorderEncounters({
  request,
  database,
  context,
  campaignId,
  params,
}: RouteInput) {
  const input = parseInput(
    z.object({
      order: z
        .array(z.object({ id: idSchema, revision: revisionSchema }))
        .max(500),
    }),
    await jsonBody(request),
  );
  return apiJson({
    encounters: createEncounterRepository(database).reorderPrepared(
      campaignId,
      context.userId,
      params.sessionId,
      input.order,
    ),
  });
}

export async function updateEncounter({
  request,
  database,
  context,
  campaignId,
  params,
}: RouteInput) {
  const encounters = createEncounterRepository(database);
  encounters.requirePreparedSession(
    campaignId,
    context.userId,
    params.sessionId,
    params.encounterId,
  );
  const { revision, ...input } = parseInput(
    revisionedPrepared,
    await jsonBody(request),
  );
  return apiJson({
    encounter: encounters.updatePrepared(
      campaignId,
      context.userId,
      params.encounterId,
      revision,
      input,
    ),
  });
}

export function deleteEncounter({
  database,
  context,
  campaignId,
  params,
}: RouteInput) {
  const encounters = createEncounterRepository(database);
  encounters.requirePreparedSession(
    campaignId,
    context.userId,
    params.sessionId,
    params.encounterId,
  );
  encounters.deletePrepared(campaignId, context.userId, params.encounterId);
  return apiJson({ deleted: true });
}

// Story beats

export function listStory({ database, context, campaignId }: RouteInput) {
  return apiJson({
    story: createContentRepository(database).listStory(
      campaignId,
      context.userId,
    ),
  });
}

export async function createStoryBeat({
  request,
  database,
  context,
  campaignId,
}: RouteInput) {
  const input = clean(parseInput(storySchema, await jsonBody(request)), [
    "details",
  ]);
  return apiJson(
    {
      beat: createContentRepository(database).createStoryBeat(
        campaignId,
        context.userId,
        input,
      ),
    },
    201,
  );
}

export async function updateStoryBeat({
  request,
  database,
  context,
  campaignId,
  params,
}: RouteInput) {
  const { revision, ...input } = clean(
    parseInput(revisionedStory, await jsonBody(request)),
    ["details"],
  );
  return apiJson({
    beat: createContentRepository(database).updateStoryBeat(
      campaignId,
      context.userId,
      params.id,
      revision,
      input,
    ),
  });
}

export function deleteStoryBeat({
  database,
  context,
  campaignId,
  params,
}: RouteInput) {
  createContentRepository(database).deleteStoryBeat(
    campaignId,
    context.userId,
    params.id,
  );
  return apiJson({ deleted: true });
}
