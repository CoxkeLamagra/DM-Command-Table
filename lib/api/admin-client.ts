export type ManagedUser = {
  id: string;
  username: string;
  displayName: string;
  isAdmin: boolean;
  updatedAt: string;
};

type UsersResponse = {
  users?: ManagedUser[];
  registrationEnabled?: boolean;
};

export type AdministrationState = {
  users: ManagedUser[];
  registrationEnabled: boolean;
};

function administrationState(body: UsersResponse): AdministrationState {
  if (!body.users || typeof body.registrationEnabled !== "boolean")
    throw new Error("Administration request failed.");
  return {
    users: body.users,
    registrationEnabled: body.registrationEnabled,
  };
}

async function readResponse(response: Promise<UsersResponse>): Promise<ManagedUser[]> {
  const body = await response;
  if (!body.users) throw new Error("User management request failed.");
  return body.users;
}

export async function fetchUsers(): Promise<ManagedUser[]> {
  return readResponse(requestJson("/api/admin/users", { cache: "no-store" }, {
    fallback: "User management request failed.",
  }));
}

export async function fetchAdministration(): Promise<AdministrationState> {
  return administrationState(
    await requestJson<UsersResponse>(
      "/api/admin/users",
      { cache: "no-store" },
      { fallback: "Administration could not be loaded." },
    ),
  );
}

export async function createManagedUser(input: {
  username: string;
  displayName: string;
  password: string;
}): Promise<ManagedUser[]> {
  return readResponse(
    requestJson(
      "/api/admin/users",
      jsonRequest("POST", input),
      { fallback: "The account could not be created." },
    ),
  );
}

export async function setAccountRegistration(
  registrationEnabled: boolean,
): Promise<AdministrationState> {
  return administrationState(
    await requestJson<UsersResponse>(
      "/api/admin/users",
      jsonRequest("PATCH", {
        action: "set-registration",
        registrationEnabled,
      }),
      { fallback: "Registration settings could not be updated." },
    ),
  );
}

export async function updateManagedUser(input: {
  id: string;
  username: string;
  displayName: string;
}): Promise<ManagedUser[]> {
  return mutate({ action: "update", ...input });
}

export async function resetManagedUserPassword(
  id: string,
  password: string,
): Promise<ManagedUser[]> {
  return mutate({ action: "reset-password", id, password });
}

export async function setManagedUserAdmin(
  id: string,
  isAdmin: boolean,
): Promise<ManagedUser[]> {
  return mutate({ action: "set-admin", id, isAdmin });
}

export async function deleteManagedUser(id: string): Promise<ManagedUser[]> {
  return readResponse(requestJson(`/api/admin/users?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
  }, { fallback: "User management request failed." }));
}

async function mutate(body: Record<string, unknown>): Promise<ManagedUser[]> {
  return readResponse(requestJson(
    "/api/admin/users",
    jsonRequest("PATCH", body),
    { fallback: "User management request failed." },
  ));
}
import { jsonRequest, requestJson } from "./http-client";
