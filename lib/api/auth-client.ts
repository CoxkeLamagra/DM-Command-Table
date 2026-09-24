import type { CampaignUser } from "@/features/campaign/types";
import { jsonRequest, requestJson } from "./http-client";

export async function authenticate(input: {
  action: "login" | "register";
  username: string;
  password: string;
  displayName?: string;
}): Promise<CampaignUser> {
  const body = await requestJson<{
    user?: CampaignUser;
  }>("/api/auth", jsonRequest("POST", input), {
    fallback: "Authentication failed",
    network: "The local server could not be reached.",
  });
  if (!body.user) throw new Error("Authentication failed");
  return body.user;
}

export async function logout(): Promise<void> {
  await fetch("/api/auth", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "logout" }),
  });
}
