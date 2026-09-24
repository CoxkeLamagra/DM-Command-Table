import type { CampaignUser } from "@/features/campaign/types";

export async function authenticate(input: {
  action: "login" | "register";
  username: string;
  password: string;
  displayName?: string;
}): Promise<CampaignUser> {
  let response: Response;
  try {
    response = await fetch("/api/auth", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
  } catch {
    throw new Error("The local server could not be reached.");
  }
  const body = (await response.json().catch(() => ({}))) as {
    user?: CampaignUser;
    error?: string;
  };
  if (!response.ok || !body.user)
    throw new Error(body.error ?? "Authentication failed");
  return body.user;
}

export async function logout(): Promise<void> {
  await fetch("/api/auth", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "logout" }),
  });
}
