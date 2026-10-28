import { parseInput } from "../http/validation.ts";
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
  const url = new URL(request.url);
  if (resource === "monsters") {
    if (method === "GET") {
      if (resourceId)
        return apiJson({
          monster: bestiary.get(campaignId, context.userId, resourceId),
        });
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
    if (method === "POST") {
      const { catalogueImport, ...input } = parseInput(
        monsterSchema.extend({ catalogueImport: z.boolean().default(false) }),
        await jsonBody(request),
      );
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
      const { revision, catalogueImport, ...input } = parseInput(
        revisionedMonster.extend({
          catalogueImport: z.boolean().default(false),
        }),
        await jsonBody(request),
      );
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
