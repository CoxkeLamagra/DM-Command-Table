import { apiHandler } from "../../../../server/http/api-handler.ts";
import { PublicApiError } from "@/server/http/errors";
import { withBodyActor } from "@/server/http/body-reader";
import { parseInput } from "../../../../server/http/validation.ts";
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

async function handleGET() {
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
async function handlePOST(request: Request) {
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
    parseInput(
      z.object({ action: z.literal("start") }).strict(),
      await withBodyActor(user.userId, () => jsonBody(request, 1024)),
    );
    requireAdministrator(database, user.userId);
    recordAuditEvent(database, {
      actorUserId: user.userId,
      resourceType: "application-update",
      action: "update-requested",
    });
    try {
      const service = await updateRequest("status");
      if (!service.available)
        throw new PublicApiError(
          "The local update service is unavailable. Check its systemd status before retrying.",
          503,
        );
      if (service.securityVersion !== 2)
        throw new PublicApiError(
          "Refresh the v12.2 root-owned updater helpers using the public-hosting guide before starting another update.",
          503,
        );
      return apiJson(
        await updateRequest("start", user.userId, () =>
          requireAdministrator(database, user.userId),
        ),
        202,
      );
    } catch (error) {
      if (error instanceof PublicApiError) return apiError(error);
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

export const GET = apiHandler(handleGET);
export const POST = apiHandler(handlePOST);

export const OPTIONS = apiHandler(
  () =>
    new Response(null, {
      status: 204,
      headers: { Allow: "GET, POST, HEAD, OPTIONS" },
    }),
);
