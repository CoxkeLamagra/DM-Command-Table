import { z } from "zod";
import { CAMPAIGN_PACKAGE_LIMIT } from "../../domain/limits.ts";
import { copyCampaign } from "../campaigns/campaign-copy.ts";
import {
  exportCampaignPackage,
  importCampaignPackage,
} from "../campaigns/campaign-package.ts";
import {
  exportCampaign,
  importCampaign,
} from "../campaigns/campaign-portable.ts";
import { createCampaignRepository } from "../campaigns/campaign-repository.ts";
import { createMembershipRepository } from "../campaigns/membership-repository.ts";
import { apiJson, jsonBody } from "../http/http.ts";
import {
  campaignCreateSchema,
  campaignUpdateSchema,
  idSchema,
  membershipSchema,
  templateSchema,
} from "../http/schemas.ts";
import { parseInput } from "../http/validation.ts";
import { createSupportRepository } from "../support/support-repository.ts";
import { clean } from "./route-schemas.ts";
import type { RouteInput } from "./route-table.ts";

export function listTemplates({ database, context }: RouteInput) {
  return apiJson({
    templates: createSupportRepository(database).listTemplates(context.userId),
  });
}

export async function saveTemplate({ request, database, context }: RouteInput) {
  const input = parseInput(templateSchema, await jsonBody(request));
  return apiJson(
    {
      template: createSupportRepository(database).saveTemplate(
        context.userId,
        input,
      ),
    },
    201,
  );
}

export function deleteTemplate({ database, context, params }: RouteInput) {
  createSupportRepository(database).deleteTemplate(
    context.userId,
    parseInput(idSchema, params.id),
  );
  return apiJson({ deleted: true });
}

export function listCampaigns({ database, context, url }: RouteInput) {
  return apiJson({
    campaigns: createCampaignRepository(database).list(context.userId, {
      archived: url.searchParams.get("archived") === "true",
    }),
  });
}

export async function createCampaign({
  request,
  database,
  context,
}: RouteInput) {
  const input = clean(
    parseInput(campaignCreateSchema, await jsonBody(request)),
    ["notes"],
  );
  return apiJson(
    {
      campaign: createCampaignRepository(database).create(
        context.userId,
        input,
      ),
    },
    201,
  );
}

export async function importCampaignRoute({
  request,
  database,
  context,
}: RouteInput) {
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

export function getCampaign({ database, context, campaignId }: RouteInput) {
  return apiJson({
    campaign: createCampaignRepository(database).get(
      campaignId,
      context.userId,
    ),
  });
}

export async function updateCampaign({
  request,
  database,
  context,
  campaignId,
}: RouteInput) {
  const input = clean(
    parseInput(campaignUpdateSchema, await jsonBody(request)),
    ["notes"],
  );
  const { revision, ...patch } = input;
  return apiJson({
    campaign: createCampaignRepository(database).update(
      campaignId,
      context.userId,
      revision,
      patch,
    ),
  });
}

export function deleteCampaign({ database, context, campaignId }: RouteInput) {
  createCampaignRepository(database).delete(campaignId, context.userId);
  return apiJson({ deleted: true });
}

export async function exportPackage({
  database,
  context,
  campaignId,
}: RouteInput) {
  return apiJson(
    await exportCampaignPackage(database, campaignId, context.userId),
  );
}

export function exportJson({ database, context, campaignId }: RouteInput) {
  return apiJson(exportCampaign(database, campaignId, context.userId));
}

export async function copy({
  request,
  database,
  context,
  campaignId,
}: RouteInput) {
  const input = parseInput(
    z.object({ mode: z.enum(["campaign", "template"]) }),
    await jsonBody(request),
  );
  return apiJson(
    {
      campaign: copyCampaign(database, campaignId, context.userId, input.mode),
    },
    201,
  );
}

export function listMembers({ database, context, campaignId }: RouteInput) {
  return apiJson({
    members: createMembershipRepository(database).list(
      campaignId,
      context.userId,
    ),
  });
}

export async function grantMember({
  request,
  database,
  context,
  campaignId,
}: RouteInput) {
  const input = parseInput(membershipSchema, await jsonBody(request));
  return apiJson({
    members: createMembershipRepository(database).grant(
      campaignId,
      context.userId,
      input.username,
      input.role,
    ),
  });
}

export async function transferOwnership({
  request,
  database,
  context,
  campaignId,
}: RouteInput) {
  const input = parseInput(
    z.object({ userId: idSchema }),
    await jsonBody(request),
  );
  return apiJson({
    members: createMembershipRepository(database).transferOwnership(
      campaignId,
      context.userId,
      input.userId,
    ),
  });
}

export function revokeMember({
  database,
  context,
  campaignId,
  params,
}: RouteInput) {
  return apiJson({
    members: createMembershipRepository(database).revoke(
      campaignId,
      context.userId,
      params.userId,
    ),
  });
}
