import type {
  Campaign,
  CampaignState,
  CampaignUser,
} from "@/features/campaign/types";

export class AuthenticationRequiredError extends Error {}

export async function fetchCampaigns(): Promise<{
  user: CampaignUser;
  campaigns: Campaign[];
}> {
  const response = await fetch("/api/campaigns", { cache: "no-store" });
  if (response.status === 401) throw new AuthenticationRequiredError();
  if (!response.ok) throw new Error("Campaigns could not be loaded");
  return response.json();
}

export async function createCampaign(
  payload: CampaignState,
  name = payload.campaignName,
): Promise<Campaign> {
  const response = await fetch("/api/campaigns", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name, payload }),
  });
  if (!response.ok) throw new Error("Campaign could not be created");
  return response.json();
}

export async function updateCampaign(
  campaign: Campaign,
  payload: CampaignState,
) {
  const response = await fetch("/api/campaigns", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      id: campaign.id,
      name: payload.campaignName,
      payload,
    }),
  });
  if (!response.ok) throw new Error("Campaign could not be saved");
  return response.json() as Promise<{ saved: true; updatedAt: string }>;
}

export async function deleteCampaign(id: string): Promise<void> {
  const response = await fetch(`/api/campaigns?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  if (!response.ok) throw new Error("Campaign could not be deleted");
}

export async function shareCampaign(
  id: string,
  username: string,
  role: "viewer" | "editor",
): Promise<void> {
  const response = await fetch("/api/campaigns", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "share", id, username, role }),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    throw new Error(body.error ?? "Campaign access could not be granted");
  }
}
