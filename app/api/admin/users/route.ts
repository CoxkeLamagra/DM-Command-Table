import {
  countAdmins,
  deleteUser,
  listUsers,
  resetUserPassword,
  setUserAdmin,
  updateUser,
} from "@/server/admin/users";
import {
  normaliseUsername,
  validateCredentials,
} from "@/server/auth/credentials";
import {
  authorizeRequest,
  readJson,
  rejectCrossOrigin,
} from "@/server/http/requests";
import {
  consumeRateLimit,
  rateLimitResponse,
} from "@/server/security/rate-limit";
import { registerLocalUser } from "@/server/auth/registration";
import {
  getRegistrationStatus,
  setRegistrationEnabled,
} from "@/server/admin/registration-settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const authorization = await authorizeRequest({ admin: true });
  if ("response" in authorization) return authorization.response;
  return administrationResponse();
}

export async function POST(request: Request) {
  const originError = rejectCrossOrigin(request);
  if (originError) return originError;
  const authorization = await authorizeRequest({ admin: true });
  if ("response" in authorization) return authorization.response;
  const { user } = authorization;
  const rateLimit = consumeRateLimit(
    `admin-create-account:${user.userId}`,
    30,
    60 * 60 * 1000,
  );
  if (!rateLimit.allowed)
    return rateLimitResponse(rateLimit.retryAfterSeconds);
  const body = await readJson<{
    username?: string;
    displayName?: string;
    password?: string;
  }>(request);
  const username = normaliseUsername(body?.username ?? "");
  const password = body?.password ?? "";
  const validation = validateCredentials(username, password);
  if (validation)
    return Response.json({ error: validation }, { status: 400 });
  const displayName =
    (body?.displayName ?? username).trim().slice(0, 80) || username;
  const result = registerLocalUser({ username, displayName, password });
  if ("error" in result)
    return Response.json({ error: result.error }, { status: result.status });
  return administrationResponse(201);
}

export async function PATCH(request: Request) {
  const originError = rejectCrossOrigin(request);
  if (originError) return originError;
  const authorization = await authorizeRequest({ admin: true });
  if ("response" in authorization) return authorization.response;
  const { user } = authorization;
  const body = await readJson<{
    action?: string;
    id?: string;
    username?: string;
    displayName?: string;
    password?: string;
    isAdmin?: boolean;
    registrationEnabled?: boolean;
  }>(request);
  if (body?.action === "set-registration") {
    setRegistrationEnabled(Boolean(body.registrationEnabled));
    return administrationResponse();
  }
  if (!body?.id)
    return Response.json({ error: "A user is required." }, { status: 400 });

  if (body.action === "update") {
    const username = normaliseUsername(body.username ?? "");
    const validation = validateCredentials(username, "temporary-password");
    if (validation)
      return Response.json({ error: validation }, { status: 400 });
    const result = updateUser(body.id, username, body.displayName ?? username);
    if (result === "duplicate")
      return Response.json({ error: "That username is already registered." }, { status: 409 });
    if (result === "not_found")
      return Response.json({ error: "User not found." }, { status: 404 });
  } else if (body.action === "reset-password") {
    const rateLimit = consumeRateLimit(
      `admin-password:${user.userId}`,
      10,
      60 * 60 * 1000,
    );
    if (!rateLimit.allowed)
      return rateLimitResponse(rateLimit.retryAfterSeconds);
    const password = body.password ?? "";
    if (password.length < 8 || password.length > 128)
      return Response.json(
        { error: "Password must be between 8 and 128 characters." },
        { status: 400 },
      );
    if (!resetUserPassword(body.id, password))
      return Response.json({ error: "User not found." }, { status: 404 });
  } else if (body.action === "set-admin") {
    if (body.id === user.userId && body.isAdmin === false)
      return Response.json(
        { error: "You cannot remove your own administrator access." },
        { status: 400 },
      );
    if (body.isAdmin === false && countAdmins() <= 1)
      return Response.json(
        { error: "At least one administrator is required." },
        { status: 400 },
      );
    if (!setUserAdmin(body.id, Boolean(body.isAdmin)))
      return Response.json({ error: "User not found." }, { status: 404 });
  } else {
    return Response.json({ error: "Unsupported admin action." }, { status: 400 });
  }
  return administrationResponse();
}

export async function DELETE(request: Request) {
  const originError = rejectCrossOrigin(request);
  if (originError) return originError;
  const authorization = await authorizeRequest({ admin: true });
  if ("response" in authorization) return authorization.response;
  const { user } = authorization;
  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!id) return Response.json({ error: "A user is required." }, { status: 400 });
  if (id === user.userId)
    return Response.json({ error: "You cannot delete your own account." }, { status: 400 });
  if (!deleteUser(id))
    return Response.json({ error: "User not found." }, { status: 404 });
  return administrationResponse();
}

function administrationResponse(status = 200) {
  return Response.json(
    {
      users: listUsers(),
      registrationEnabled: getRegistrationStatus().registrationEnabled,
    },
    { status, headers: { "cache-control": "no-store" } },
  );
}
