import type { CampaignMember, Campaign, SearchResult } from "@/domain/types";
import { requestJson, json } from "./transport";
export async function listCampaigns(archived = false): Promise<Campaign[]> {
  const result = await requestJson<{ campaigns: Campaign[] }>(
    `/api/campaigns?archived=${archived}`,
  );
  return result.campaigns;
}

export async function getCampaign(campaignId: string): Promise<Campaign> {
  return (
    await requestJson<{ campaign: Campaign }>(`/api/campaigns/${campaignId}`)
  ).campaign;
}

export async function createCampaign(name = "New campaign"): Promise<Campaign> {
  const result = await requestJson<{ campaign: Campaign }>(
    "/api/campaigns",
    json("POST", { name, notes: "" }),
  );
  return result.campaign;
}

export async function updateCampaign(
  campaign: Campaign,
  patch: Partial<Pick<Campaign, "name" | "notes" | "archived">>,
): Promise<Campaign> {
  const result = await requestJson<{ campaign: Campaign }>(
    `/api/campaigns/${campaign.id}`,
    json("PATCH", { revision: campaign.revision, ...patch }),
  );
  return result.campaign;
}

export async function copyCampaign(
  campaignId: string,
  mode: "campaign" | "template",
): Promise<Campaign> {
  return (
    await requestJson<{ campaign: Campaign }>(
      `/api/campaigns/${campaignId}/copy`,
      json("POST", { mode }),
    )
  ).campaign;
}

export async function deleteCampaign(campaignId: string): Promise<void> {
  await requestJson(`/api/campaigns/${campaignId}`, { method: "DELETE" });
}

export async function exportCampaign(
  campaignId: string,
): Promise<Record<string, unknown>> {
  return requestJson(`/api/campaigns/${campaignId}/export`);
}

export async function importCampaign(value: unknown): Promise<Campaign> {
  return (
    await requestJson<{ campaign: Campaign }>(
      "/api/campaigns/import",
      json("POST", value),
    )
  ).campaign;
}

export async function listCampaignMembers(
  campaignId: string,
): Promise<CampaignMember[]> {
  const result = await requestJson<{ members: CampaignMember[] }>(
    `/api/campaigns/${campaignId}/members`,
  );
  return result.members;
}

export async function grantCampaignAccess(
  campaignId: string,
  username: string,
  role: "viewer" | "editor",
): Promise<CampaignMember[]> {
  const result = await requestJson<{ members: CampaignMember[] }>(
    `/api/campaigns/${campaignId}/members`,
    json("POST", { username, role }),
  );
  return result.members;
}

export async function revokeCampaignAccess(
  campaignId: string,
  userId: string,
): Promise<CampaignMember[]> {
  const result = await requestJson<{ members: CampaignMember[] }>(
    `/api/campaigns/${campaignId}/members/${userId}`,
    { method: "DELETE" },
  );
  return result.members;
}

export async function transferCampaignOwnership(
  campaignId: string,
  userId: string,
): Promise<CampaignMember[]> {
  const result = await requestJson<{ members: CampaignMember[] }>(
    `/api/campaigns/${campaignId}/members/transfer`,
    json("POST", { userId }),
  );
  return result.members;
}

export async function searchCampaign(
  campaignId: string,
  query: string,
  type = "all",
): Promise<SearchResult[]> {
  return (
    await requestJson<{ results: SearchResult[] }>(
      `/api/campaigns/${campaignId}/search?q=${encodeURIComponent(query)}&type=${encodeURIComponent(type)}`,
    )
  ).results;
}

export async function deleteRecords(
  campaignId: string,
  resource: "players" | "monsters",
  ids: string[],
): Promise<void> {
  await requestJson(
    `/api/campaigns/${campaignId}/${resource}/bulk-delete`,
    json("POST", { ids }),
  );
}

export function exportPackage(campaignId: string): Promise<unknown> {
  return requestJson(`/api/campaigns/${campaignId}/package`);
}
