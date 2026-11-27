import { parseInput } from "../../../server/http/validation.ts";
import { z } from "zod";
import { changePassword, renameAccount } from "@/server/identity/accounts";
import { createSession } from "@/server/identity/auth";
import { apiJson, jsonBody } from "@/server/http/http";
import { withApiUser } from "@/server/http/api-handler";
import { rateLimited } from "@/server/http/request-security";

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

export const PATCH = withApiUser(async ({ request, database, user }) => {
  const input = parseInput(schema, await jsonBody(request, 8192));
  // The budget depends on the action, so it is charged after parsing.
  const limited = rateLimited(
    database,
    request,
    input.action === "change-password" ? "password" : "account",
    user.userId,
  );
  if (limited) return limited;
  if (input.action === "rename") {
    renameAccount(database, user.userId, input.username, input.displayName);
  } else {
    const authenticated = await changePassword(
      database,
      user.userId,
      input.currentPassword,
      input.newPassword,
    );
    await createSession(authenticated, database);
  }
  return apiJson({ changed: true });
});
