import { z } from "zod";
import { getV6Database } from "@/db/v6-sqlite";
import { rejectCrossOrigin } from "@/server/http/origin";
import { changeV6Password, renameV6Account } from "@/server/v6/accounts";
import { createV6Session, getV6User } from "@/server/v6/auth";
import { apiError, apiJson, jsonBody } from "@/server/v6/http";
import { enforceV6RateLimit } from "@/server/v6/request-security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("rename"),
    username: z.string(),
    displayName: z.string().optional(),
  }),
  z.object({
    action: z.literal("change-password"),
    currentPassword: z.string(),
    newPassword: z.string(),
  }),
]);

export async function PATCH(request: Request) {
  const origin = rejectCrossOrigin(request);
  if (origin) return origin;
  try {
    const database = getV6Database();
    const user = await getV6User(database);
    if (!user) return apiJson({ error: "Authentication required." }, 401);
    const input = schema.parse(await jsonBody(request));
    const limited = enforceV6RateLimit(
      database,
      request,
      input.action === "change-password" ? "v6-password" : "v6-account",
      user.userId,
      input.action === "change-password" ? 10 : 60,
      60 * 60 * 1000,
    );
    if (limited) return limited;
    if (input.action === "rename") {
      renameV6Account(database, user.userId, input.username, input.displayName);
    } else {
      await changeV6Password(
        database,
        user.userId,
        input.currentPassword,
        input.newPassword,
      );
      await createV6Session(user.userId, database);
    }
    return apiJson({ changed: true });
  } catch (error) {
    return apiError(error);
  }
}
