import { parseInput } from "../http/validation.ts";
import { z } from "zod";
import { createBestiaryRepository } from "../bestiary/bestiary-repository.ts";
import { apiJson, jsonBody } from "../http/http.ts";
import { monsterSchema } from "../http/schemas.ts";
import { revisionedMonster } from "./route-schemas.ts";
import type { RouteInput } from "./route-table.ts";

/** Full list, or 100-record summary pages with `?view=summary&after=&q=`. */
export function listMonsters({
  database,
  context,
  campaignId,
  url,
}: RouteInput) {
  const bestiary = createBestiaryRepository(database);
  if (url.searchParams.get("view") === "summary") {
    const after = url.searchParams.get("after") ?? "";
    if (after && !z.uuid().safeParse(after).success)
      return apiJson({ error: "Invalid page cursor." }, 400);
    return apiJson(
      bestiary.summaries(
        campaignId,
        context.userId,
        after,
        url.searchParams.get("q") ?? "",
      ),
    );
  }
  return apiJson({ monsters: bestiary.list(campaignId, context.userId) });
}

export function getMonster({
  database,
  context,
  campaignId,
  params,
}: RouteInput) {
  return apiJson({
    monster: createBestiaryRepository(database).get(
      campaignId,
      context.userId,
      params.id,
    ),
  });
}

export async function createMonster({
  request,
  database,
  context,
  campaignId,
}: RouteInput) {
  const { catalogueImport, ...input } = parseInput(
    monsterSchema.extend({ catalogueImport: z.boolean().default(false) }),
    await jsonBody(request),
  );
  return apiJson(
    {
      monster: createBestiaryRepository(database).create(
        campaignId,
        context.userId,
        input,
        catalogueImport,
      ),
    },
    201,
  );
}

export async function updateMonster({
  request,
  database,
  context,
  campaignId,
  params,
}: RouteInput) {
  const { revision, catalogueImport, ...input } = parseInput(
    revisionedMonster.extend({
      catalogueImport: z.boolean().default(false),
    }),
    await jsonBody(request),
  );
  return apiJson({
    monster: createBestiaryRepository(database).update(
      campaignId,
      context.userId,
      params.id,
      revision,
      input,
      catalogueImport,
    ),
  });
}

export function deleteMonster({
  database,
  context,
  campaignId,
  params,
}: RouteInput) {
  createBestiaryRepository(database).delete(
    campaignId,
    context.userId,
    params.id,
  );
  return apiJson({ deleted: true });
}
