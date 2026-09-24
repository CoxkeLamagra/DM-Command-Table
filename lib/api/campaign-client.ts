import type {
  Campaign,
  CampaignState,
  CampaignUser,
} from "@/features/campaign/types";
import { ApiRequestError, jsonRequest, requestJson } from "./http-client";

export class AuthenticationRequiredError extends Error {}

export async function fetchCampaigns(): Promise<{
  user: CampaignUser;
  campaigns: Campaign[];
}> {
  try {
    return await requestJson("/api/campaigns", { cache: "no-store" }, {
      fallback: "Campaigns could not be loaded",
      serverErrors: false,
    });
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 401)
      throw new AuthenticationRequiredError();
    throw error;
  }
}

export async function createCampaign(
  payload: CampaignState,
  name = payload.campaignName,
): Promise<Campaign> {
  return requestJson(
    "/api/campaigns",
    jsonRequest("POST", { name, payload }),
    { fallback: "Campaign could not be created", serverErrors: false },
  );
}

export async function updateCampaign(
  campaign: Campaign,
  payload: CampaignState,
) {
  return requestJson<{ saved: true; updatedAt: string }>(
    "/api/campaigns",
    jsonRequest("PUT", {
      id: campaign.id,
      name: payload.campaignName,
      payload,
    }),
    { fallback: "Campaign could not be saved", serverErrors: false },
  );
}

export async function deleteCampaign(id: string): Promise<void> {
  await requestJson(
    `/api/campaigns?id=${encodeURIComponent(id)}`,
    { method: "DELETE" },
    { fallback: "Campaign could not be deleted", serverErrors: false },
  );
}

export async function shareCampaign(
  id: string,
  username: string,
  role: "viewer" | "editor",
): Promise<void> {
  await requestJson(
    "/api/campaigns",
    jsonRequest("POST", { action: "share", id, username, role }),
    { fallback: "Campaign access could not be granted" },
  );
}
