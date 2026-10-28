import {
  requireCampaignRead,
  requireCampaignEdit,
  requireCampaignOwner,
} from "../campaigns/access.ts";
import { parseInput } from "../http/validation.ts";
import { acceptsApiRoute } from "../http/api-contract.ts";
import { parseApiRoute, type ApiRoute } from "../http/api-route.ts";
import type { DatabaseSync } from "node:sqlite";
import {
  exportCampaignPackage,
  importCampaignPackage,
} from "../campaigns/campaign-package.ts";
import { CAMPAIGN_PACKAGE_LIMIT } from "../../domain/limits.ts";
import { z } from "zod";
import { createCampaignRepository } from "../campaigns/campaign-repository.ts";
import { apiError, apiJson, jsonBody, type ApiContext } from "../http/http.ts";
import { createMembershipRepository } from "../campaigns/membership-repository.ts";
import {
  campaignCreateSchema,
  campaignUpdateSchema,
  idSchema,
  membershipSchema,
  templateSchema,
} from "../http/schemas.ts";
import { createSupportRepository } from "../support/support-repository.ts";
import { copyCampaign } from "../campaigns/campaign-copy.ts";
import {
  exportCampaign,
  importCampaign,
} from "../campaigns/campaign-portable.ts";
import { handleContentRoutes } from "./content-routes.ts";
import { handleBestiaryRoutes } from "./bestiary-routes.ts";
import { handleCombatRoutes } from "./combat-routes.ts";
import { handleSearchRoutes } from "./search-routes.ts";
import { clean } from "./route-schemas.ts";
export async function handleApi(
  request: Request,
  database: DatabaseSync,
  context: ApiContext,
  parsedRoute?: ApiRoute,
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const { segments } = parsedRoute ?? parseApiRoute(url.pathname);
    const method = request.method.toUpperCase();
    if (!acceptsApiRoute(segments, method))
      return apiJson({ error: "API resource not found." }, 404);
    const campaigns = createCampaignRepository(database);
    const memberships = createMembershipRepository(database);
    const support = createSupportRepository(database);

    if (segments[0] === "templates") {
      if (method === "GET")
        return apiJson({ templates: support.listTemplates(context.userId) });
      if (method === "POST") {
        const input = parseInput(templateSchema, await jsonBody(request));
        return apiJson(
          { template: support.saveTemplate(context.userId, input) },
          201,
        );
      }
      if (method === "DELETE" && segments[1]) {
        support.deleteTemplate(
          context.userId,
          parseInput(idSchema, segments[1]),
        );
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
          parseInput(campaignCreateSchema, await jsonBody(request)),
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
    const campaignId = parseInput(idSchema, segments[1]);
    if (method === "GET")
      requireCampaignRead(database, campaignId, context.userId);
    else if (
      segments[2] === "members" ||
      (segments.length === 2 && method === "DELETE")
    )
      requireCampaignOwner(database, campaignId, context.userId);
    else if (segments[2] === "copy")
      requireCampaignRead(database, campaignId, context.userId);
    else requireCampaignEdit(database, campaignId, context.userId);
    if (segments.length === 2) {
      if (method === "GET")
        return apiJson({ campaign: campaigns.get(campaignId, context.userId) });
      if (method === "PATCH") {
        const input = clean(
          parseInput(campaignUpdateSchema, await jsonBody(request)),
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
      const input = parseInput(
        z.object({ mode: z.enum(["campaign", "template"]) }),
        await jsonBody(request),
      );
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
        const input = parseInput(
          z.object({ userId: idSchema }),
          await jsonBody(request),
        );
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
        const input = parseInput(membershipSchema, await jsonBody(request));
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

    const input = {
      request,
      database,
      context,
      campaignId,
      resource,
      resourceId,
      segments,
      method,
      url,
    };
    const handlers: Record<
      string,
      (input: import("./route-input.ts").RouteInput) => Promise<Response | null>
    > = {
      players: handleContentRoutes,
      sessions: handleContentRoutes,
      story: handleContentRoutes,
      monsters:
        resourceId === "bulk-delete"
          ? handleContentRoutes
          : handleBestiaryRoutes,
      combat: handleCombatRoutes,
      search: handleSearchRoutes,
    };
    const handler = handlers[resource];
    if (handler) {
      const response = await handler(input);
      if (response) return response;
    }

    return apiJson({ error: "API resource not found." }, 404);
  } catch (error) {
    return apiError(error);
  }
}
