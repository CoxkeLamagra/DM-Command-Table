import { z } from "zod";
import { getV6Database } from "@/db/v6-sqlite";
import { rejectCrossOrigin } from "@/server/http/origin";
import { createV6ManagedUser, deleteV6ManagedUser, listV6Users, updateV6ManagedUser } from "@/server/v6/accounts";
import { getV6User, registrationStatus, setRegistrationEnabled } from "@/server/v6/auth";
import { PublicApiError } from "@/server/v6/errors";
import { apiError, apiJson, jsonBody } from "@/server/v6/http";
import { enforceV6RateLimit } from "@/server/v6/request-security";
import { getV6ServerSettings, saveV6ServerSettings, serverSettingsSchema } from "@/server/v6/server-settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function admin() {
  const database = getV6Database();
  const user = await getV6User(database);
  return { database, user };
}
function state(database: ReturnType<typeof getV6Database>) {
  return {
    users: listV6Users(database),
    registrationEnabled: registrationStatus(database).registrationEnabled,
    serverSettings: getV6ServerSettings(database),
  };
}

export async function GET() {
  const { database, user } = await admin();
  return !user?.isAdmin ? apiJson({ error: "Administrator access required." }, 403) : apiJson(state(database));
}
export async function POST(request: Request) { return mutate(request, "create"); }
export async function PATCH(request: Request) { return mutate(request, "update"); }
export async function DELETE(request: Request) { return mutate(request, "delete"); }

async function mutate(request: Request, operation: "create" | "update" | "delete") {
  const origin = rejectCrossOrigin(request);
  if (origin) return origin;
  try {
    const { database, user } = await admin();
    if (!user?.isAdmin) return apiJson({ error: "Administrator access required." }, 403);
    const limited = enforceV6RateLimit(
      database, request, `v6-admin-${operation}`, user.userId,
      operation === "update" ? 30 : 20, 60 * 60 * 1000,
    );
    if (limited) return limited;
    if (operation === "create") {
      const input = z.object({ username: z.string(), displayName: z.string(), password: z.string() }).parse(await jsonBody(request));
      createV6ManagedUser(database, input);
      return apiJson(state(database), 201);
    }
    if (operation === "delete") {
      deleteV6ManagedUser(database, new URL(request.url).searchParams.get("id") ?? "", user.userId);
      return apiJson(state(database));
    }
    const input = z.object({
      action: z.enum(["update", "set-registration", "set-server-settings"]), id: z.string().optional(),
      username: z.string().optional(), displayName: z.string().optional(), password: z.string().optional(),
      isAdmin: z.boolean().optional(), registrationEnabled: z.boolean().optional(),
      serverSettings: serverSettingsSchema.optional(),
    }).parse(await jsonBody(request));
    if (input.action === "set-registration") setRegistrationEnabled(database, Boolean(input.registrationEnabled));
    else if (input.action === "set-server-settings") saveV6ServerSettings(database, input.serverSettings);
    else {
      if (!input.id) throw new PublicApiError("A user is required.");
      updateV6ManagedUser(database, input.id, input, user.userId);
    }
    return apiJson(state(database));
  } catch (error) {
    return apiError(error instanceof Error && error.constructor === Error ? new PublicApiError(error.message) : error);
  }
}
