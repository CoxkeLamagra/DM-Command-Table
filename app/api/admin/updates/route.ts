import { parseInput } from "../../../../server/http/validation.ts";
import { z } from "zod";
import { requireAdministrator } from "@/server/identity/accounts";
import { apiJson, jsonBody } from "@/server/http/http";
import { withApiUser } from "@/server/http/api-handler";
import { updateRequest } from "@/server/administration/updates";
import { recordAuditEvent } from "@/server/support/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withApiUser(
  async ({ database, user }) => {
    const result = await updateRequest("status");
    requireAdministrator(database, user.userId);
    return apiJson(result);
  },
  { admin: true },
);

export const POST = withApiUser(
  async ({ request, database, user }) => {
    parseInput(
      z.object({ action: z.literal("start") }).strict(),
      await jsonBody(request, 1024),
    );
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
  },
  { admin: true, rateLimit: "applicationUpdate" },
);
