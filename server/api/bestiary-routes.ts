import { createBestiaryRepository } from "../bestiary/bestiary-repository.ts";
import { apiJson, jsonBody } from "../http/http.ts";
import { monsterSchema } from "../http/schemas.ts";
import { revisionedMonster, clean } from "./route-schemas.ts";
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
      const input = clean(monsterSchema.parse(await jsonBody(request)), [
        "token",
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
        ["token", "abilities", "spells", "notes"],
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

  return null;
}
