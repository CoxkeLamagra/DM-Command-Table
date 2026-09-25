import { changeOwnPassword, renameAccount } from "@/server/auth/account";
import {
  normaliseUsername,
  validateCredentials,
} from "@/server/auth/credentials";
import { createSession } from "@/server/auth/sessions";
import {
  authorizeRequest,
  readJson,
  rejectCrossOrigin,
} from "@/server/http/requests";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request: Request) {
  const originError = rejectCrossOrigin(request);
  if (originError) return originError;
  const authorization = await authorizeRequest();
  if ("response" in authorization) return authorization.response;
  const { user } = authorization;
  const body = await readJson<{
    action?: string;
    username?: string;
    currentPassword?: string;
    newPassword?: string;
  }>(request);

  if (body?.action === "rename") {
    const username = normaliseUsername(body.username ?? "");
    const validation = validateCredentials(username, "temporary-password");
    if (validation)
      return Response.json({ error: validation }, { status: 400 });
    const result = renameAccount(user.userId, username);
    if (result === "duplicate")
      return Response.json(
        { error: "That username is already registered." },
        { status: 409 },
      );
    if (result === "not_found")
      return Response.json({ error: "Account not found." }, { status: 404 });
    return Response.json({ username });
  }

  if (body?.action === "change-password") {
    const newPassword = body.newPassword ?? "";
    if (newPassword.length < 8 || newPassword.length > 128)
      return Response.json(
        { error: "Password must be between 8 and 128 characters." },
        { status: 400 },
      );
    const result = changeOwnPassword(
      user.userId,
      body.currentPassword ?? "",
      newPassword,
    );
    if (result === "invalid_password")
      return Response.json(
        { error: "The current password is incorrect." },
        { status: 401 },
      );
    if (result === "not_found")
      return Response.json({ error: "Account not found." }, { status: 404 });
    await createSession(user.userId);
    return Response.json({ changed: true });
  }

  return Response.json(
    { error: "Unsupported account action." },
    { status: 400 },
  );
}
