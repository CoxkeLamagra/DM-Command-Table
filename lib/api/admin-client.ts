export type ManagedUser = {
  id: string;
  username: string;
  displayName: string;
  isAdmin: boolean;
  updatedAt: string;
};

type UsersResponse = { users?: ManagedUser[]; error?: string };

async function readResponse(response: Response): Promise<ManagedUser[]> {
  const body = (await response.json().catch(() => ({}))) as UsersResponse;
  if (!response.ok || !body.users)
    throw new Error(body.error ?? "User management request failed.");
  return body.users;
}

export async function fetchUsers(): Promise<ManagedUser[]> {
  return readResponse(await fetch("/api/admin/users", { cache: "no-store" }));
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
  return readResponse(
    await fetch(`/api/admin/users?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),
  );
}

async function mutate(body: Record<string, unknown>): Promise<ManagedUser[]> {
  return readResponse(
    await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}
