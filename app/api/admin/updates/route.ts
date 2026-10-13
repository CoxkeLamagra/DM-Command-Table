import { z } from "zod";
import { getDatabase } from "@/db/sqlite";
import { getUser } from "@/server/identity/auth";
import { requireAdministrator } from "@/server/identity/accounts";
import { rejectCrossOrigin } from "@/server/http/origin";
import { apiJson, apiError, jsonBody } from "@/server/http/http";
import { enforceRateLimit } from "@/server/http/request-security";
import { updateRequest } from "@/server/administration/updates";
import { recordAuditEvent } from "@/server/support/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const database = getDatabase();
    const user = await getUser(database);
    if (!user?.isAdmin)
      return apiJson({ error: "Administrator access required." }, 403);
    const result = await updateRequest("status");
    requireAdministrator(database, user.userId);
    return apiJson(result);
  } catch (error) {
    return apiError(error);
  }
}
export async function POST(request: Request) {
  const origin = rejectCrossOrigin(request);
  if (origin) return origin;
  try {
    const database = getDatabase();
    const user = await getUser(database);
    if (!user?.isAdmin)
      return apiJson({ error: "Administrator access required." }, 403);
    const limited = enforceRateLimit(
      database,
      request,
      "admin-update",
      user.userId,
      6,
      60 * 60 * 1000,
    );
    if (limited) return limited;
    z.object({ action: z.literal("start") })
      .strict()
      .parse(await jsonBody(request, 1024));
    requireAdministrator(database, user.userId);
    recordAuditEvent(database, {
      actorUserId: user.userId,
      resourceType: "application-update",
      action: "update-requested",
    });
    try {
      return apiJson(await updateRequest("start", user.userId), 202);
    } catch {
      return apiJson(
        {
          error:
            "The local update service is unavailable. Check its systemd status before retrying.",
        },
        503,
      );
    }
  } catch (error) {
    return apiError(error);
  }
}
