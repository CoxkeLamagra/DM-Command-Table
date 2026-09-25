import { jsonRequest, requestJson } from "./http-client";

export async function renameOwnAccount(username: string): Promise<string> {
  const body = await requestJson<{ username?: string }>(
    "/api/account",
    jsonRequest("PATCH", { action: "rename", username }),
    { fallback: "The account could not be renamed." },
  );
  if (!body.username) throw new Error("The account could not be renamed.");
  return body.username;
}

export async function changeOwnPassword(input: {
  currentPassword: string;
  newPassword: string;
}): Promise<void> {
  await requestJson(
    "/api/account",
    jsonRequest("PATCH", { action: "change-password", ...input }),
    { fallback: "The password could not be changed." },
  );
}
