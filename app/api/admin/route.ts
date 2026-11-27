import { parseInput } from "../../../server/http/validation.ts";
import { databaseUsage } from "@/server/security/storage-budget";
import { z } from "zod";
import type { DatabaseSync } from "node:sqlite";
import type { User } from "@/domain/types";
import { withApiUser } from "@/server/http/api-handler";
import {
  requireAdministrator,
  createManagedUser,
  deleteManagedUser,
  listUsers,
  updateManagedUser,
} from "@/server/identity/accounts";
import {
  registrationStatus,
  setRegistrationEnabled,
} from "@/server/identity/auth";
import { PublicApiError } from "@/server/http/errors";
import { apiJson, jsonBody } from "@/server/http/http";
import {
  getServerSettings,
  saveServerSettings,
  serverSettingsSchema,
} from "@/server/administration/server-settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function state(database: DatabaseSync) {
  return {
    storage: databaseUsage(database),
    users: listUsers(database),
    registrationEnabled: registrationStatus(database).registrationEnabled,
    serverSettings: getServerSettings(database),
  };
}

export const GET = withApiUser(({ database }) => apiJson(state(database)), {
  admin: true,
});
export const POST = withApiUser(
  ({ request, database, user }) => mutate(request, database, user, "create"),
  { admin: true, rateLimit: "adminCreate" },
);
export const PATCH = withApiUser(
  ({ request, database, user }) => mutate(request, database, user, "update"),
  { admin: true, rateLimit: "adminUpdate" },
);
export const DELETE = withApiUser(
  ({ request, database, user }) => mutate(request, database, user, "delete"),
  { admin: true, rateLimit: "adminDelete" },
);

async function mutate(
  request: Request,
  database: DatabaseSync,
  user: User,
  operation: "create" | "update" | "delete",
) {
  if (operation === "create") {
    const input = parseInput(
      z.object({
        username: z.string(),
        displayName: z.string(),
        password: z.string(),
      }),
      await jsonBody(request),
    );
    await createManagedUser(database, input, user.userId);
    return apiJson(state(database), 201);
  }
  if (operation === "delete") {
    deleteManagedUser(
      database,
      new URL(request.url).searchParams.get("id") ?? "",
      user.userId,
    );
    return apiJson(state(database));
  }
  const input = parseInput(
    z.object({
      action: z.enum(["update", "set-registration", "set-server-settings"]),
      id: z.string().optional(),
      username: z.string().optional(),
      displayName: z.string().optional(),
      password: z.string().optional(),
      isAdmin: z.boolean().optional(),
      registrationEnabled: z.boolean().optional(),
      serverSettings: serverSettingsSchema.optional(),
    }),
    await jsonBody(request),
  );
  requireAdministrator(database, user.userId);
  if (input.action === "set-registration")
    setRegistrationEnabled(database, Boolean(input.registrationEnabled));
  else if (input.action === "set-server-settings")
    saveServerSettings(database, input.serverSettings);
  else {
    if (!input.id) throw new PublicApiError("A user is required.");
    await updateManagedUser(database, input.id, input, user.userId);
  }
  return apiJson(state(database));
}
