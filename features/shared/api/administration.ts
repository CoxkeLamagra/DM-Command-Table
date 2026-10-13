import type { Administration, ServerSettings } from "@/domain/types";
import { requestJson, json } from "./transport";
export async function getAdministration(): Promise<Administration> {
  return requestJson("/api/admin");
}

export async function createManagedAccount(input: {
  username: string;
  displayName: string;
  password: string;
}) {
  return requestJson<Administration>("/api/admin", json("POST", input));
}

export async function updateManagedAccount(input: {
  action: "update";
  id: string;
  username?: string;
  displayName?: string;
  password?: string;
  isAdmin?: boolean;
}) {
  return requestJson<Administration>("/api/admin", json("PATCH", input));
}

export async function setRegistration(registrationEnabled: boolean) {
  return requestJson<Administration>(
    "/api/admin",
    json("PATCH", { action: "set-registration", registrationEnabled }),
  );
}

export async function setServerSettings(serverSettings: ServerSettings) {
  return requestJson<Administration>(
    "/api/admin",
    json("PATCH", { action: "set-server-settings", serverSettings }),
  );
}

export async function deleteManagedAccount(id: string) {
  return requestJson<Administration>(
    `/api/admin?id=${encodeURIComponent(id)}`,
    { method: "DELETE" },
  );
}
