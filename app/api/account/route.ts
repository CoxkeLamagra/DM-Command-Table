import { z } from "zod";
import { getDatabase } from "@/db/sqlite";
import { rejectCrossOrigin } from "@/server/http/origin";
import { changePassword, renameAccount } from "@/server/identity/accounts";
import { createSession, getUser } from "@/server/identity/auth";
import { apiError, apiJson, jsonBody } from "@/server/http/http";
import { enforceRateLimit } from "@/server/http/request-security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("rename"),
    username: z.string().max(32),
    displayName: z.string().max(80).optional(),
  }),
  z.object({
    action: z.literal("change-password"),
    currentPassword: z.string().max(128),
    newPassword: z.string().max(128),
  }),
]);

export async function PATCH(request: Request) {
  const origin = rejectCrossOrigin(request);
  if (origin) return origin;
  try {
    const database = getDatabase();
    const user = await getUser(database);
    if (!user) return apiJson({ error: "Authentication required." }, 401);
    const input = schema.parse(await jsonBody(request, 8192));
    const limited = enforceRateLimit(
      database,
      request,
      input.action === "change-password" ? "password" : "account",
      user.userId,
      input.action === "change-password" ? 10 : 60,
      60 * 60 * 1000,
    );
    if (limited) return limited;
    if (input.action === "rename") {
      renameAccount(database, user.userId, input.username, input.displayName);
    } else {
      await changePassword(
        database,
        user.userId,
        input.currentPassword,
        input.newPassword,
      );
      await createSession(user.userId, database);
    }
    return apiJson({ changed: true });
  } catch (error) {
    return apiError(error);
  }
}
