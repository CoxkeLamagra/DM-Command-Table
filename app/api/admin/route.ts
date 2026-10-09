import { z } from "zod";
import { getDatabase } from "@/db/sqlite";
import { rejectCrossOrigin } from "@/server/http/origin";
import {
  createManagedUser,
  deleteManagedUser,
  listUsers,
  updateManagedUser,
} from "@/server/identity/accounts";
import {
  getUser,
  registrationStatus,
  setRegistrationEnabled,
} from "@/server/identity/auth";
import { PublicApiError } from "@/server/http/errors";
import { apiError, apiJson, jsonBody } from "@/server/http/http";
import { enforceRateLimit } from "@/server/http/request-security";
import {
  getServerSettings,
  saveServerSettings,
  serverSettingsSchema,
} from "@/server/administration/server-settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function admin() {
  const database = getDatabase();
  const user = await getUser(database);
  return { database, user };
}
function state(database: ReturnType<typeof getDatabase>) {
  return {
    users: listUsers(database),
    registrationEnabled: registrationStatus(database).registrationEnabled,
    serverSettings: getServerSettings(database),
  };
}

export async function GET() {
  const { database, user } = await admin();
  return !user?.isAdmin
    ? apiJson({ error: "Administrator access required." }, 403)
    : apiJson(state(database));
}
export async function POST(request: Request) {
  return mutate(request, "create");
}
export async function PATCH(request: Request) {
  return mutate(request, "update");
}
export async function DELETE(request: Request) {
  return mutate(request, "delete");
}

async function mutate(
  request: Request,
  operation: "create" | "update" | "delete",
) {
  const origin = rejectCrossOrigin(request);
  if (origin) return origin;
  try {
    const { database, user } = await admin();
    if (!user?.isAdmin)
      return apiJson({ error: "Administrator access required." }, 403);
    const limited = enforceRateLimit(
      database,
      request,
      `admin-${operation}`,
      user.userId,
      operation === "update" ? 30 : 20,
      60 * 60 * 1000,
    );
    if (limited) return limited;
    if (operation === "create") {
      const input = z
        .object({
          username: z.string(),
          displayName: z.string(),
          password: z.string(),
        })
        .parse(await jsonBody(request));
      await createManagedUser(database, input);
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
    const input = z
      .object({
        action: z.enum(["update", "set-registration", "set-server-settings"]),
        id: z.string().optional(),
        username: z.string().optional(),
        displayName: z.string().optional(),
        password: z.string().optional(),
        isAdmin: z.boolean().optional(),
        registrationEnabled: z.boolean().optional(),
        serverSettings: serverSettingsSchema.optional(),
      })
      .parse(await jsonBody(request));
    if (input.action === "set-registration")
      setRegistrationEnabled(database, Boolean(input.registrationEnabled));
    else if (input.action === "set-server-settings")
      saveServerSettings(database, input.serverSettings);
    else {
      if (!input.id) throw new PublicApiError("A user is required.");
      await updateManagedUser(database, input.id, input, user.userId);
    }
    return apiJson(state(database));
  } catch (error) {
    return apiError(error);
  }
}
