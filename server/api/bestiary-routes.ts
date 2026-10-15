import { z } from "zod";
import { createBestiaryRepository } from "../bestiary/bestiary-repository.ts";
import { apiJson, jsonBody } from "../http/http.ts";
import { monsterSchema } from "../http/schemas.ts";
import { revisionedMonster } from "./route-schemas.ts";
import type { RouteInput } from "./route-input.ts";
export async function handleBestiaryRoutes(
  input: RouteInput,
): Promise<Response | null> {
  const {
    database,
    request,
    context,
    campaignId,
    resource,
    resourceId,
    method,
  } = input;
  const bestiary = createBestiaryRepository(database);
  if (resource === "monsters") {
    if (method === "GET")
      return apiJson({ monsters: bestiary.list(campaignId, context.userId) });
    if (method === "POST") {
      const { catalogueImport, ...input } = monsterSchema
        .extend({ catalogueImport: z.boolean().default(false) })
        .parse(await jsonBody(request));
      return apiJson(
        {
          monster: bestiary.create(
            campaignId,
            context.userId,
            input,
            catalogueImport,
          ),
        },
        201,
      );
    }
    if (resourceId && method === "PATCH") {
      const { revision, catalogueImport, ...input } = revisionedMonster
        .extend({ catalogueImport: z.boolean().default(false) })
        .parse(await jsonBody(request));
      return apiJson({
        monster: bestiary.update(
          campaignId,
          context.userId,
          resourceId,
          revision,
          input,
          catalogueImport,
        ),
      });
    }
    if (resourceId && method === "DELETE") {
      bestiary.delete(campaignId, context.userId, resourceId);
      return apiJson({ deleted: true });
    }
  }

  return null;
}
