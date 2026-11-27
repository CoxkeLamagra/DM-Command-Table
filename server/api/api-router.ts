import type { DatabaseSync } from "node:sqlite";
import {
  requireCampaignEdit,
  requireCampaignOwner,
  requireCampaignRead,
} from "../campaigns/access.ts";
import { parseApiRoute, type ApiRoute } from "../http/api-route.ts";
import { apiError, apiJson, type ApiContext } from "../http/http.ts";
import { idSchema } from "../http/schemas.ts";
import { parseInput } from "../http/validation.ts";
import type { RouteAccess } from "./route-table.ts";
import { apiRoutes } from "./routes.ts";

const permission: Record<
  Exclude<RouteAccess, "user">,
  (database: DatabaseSync, campaignId: string, userId: string) => unknown
> = {
  read: requireCampaignRead,
  edit: requireCampaignEdit,
  owner: requireCampaignOwner,
};

export async function handleApi(
  request: Request,
  database: DatabaseSync,
  context: ApiContext,
  parsedRoute?: ApiRoute,
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const { segments } = parsedRoute ?? parseApiRoute(url.pathname);
    const match = apiRoutes.match(segments, request.method.toUpperCase());
    if (!match) return apiJson({ error: "API resource not found." }, 404);
    const { route, params } = match;
    const campaignId =
      params.campaignId === undefined
        ? ""
        : parseInput(idSchema, params.campaignId);
    if (route.access !== "user")
      permission[route.access](database, campaignId, context.userId);
    return await route.handler({
      request,
      database,
      context,
      url,
      params,
      campaignId,
    });
  } catch (error) {
    return apiError(error);
  }
}
