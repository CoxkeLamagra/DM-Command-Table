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

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const authorization = await authorizeRequest({ admin: true });
  if ("response" in authorization) return authorization.response;
  return Response.json({ users: listUsers() });
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
  }>(request);
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
  return Response.json({ users: listUsers() });
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
  return Response.json({ users: listUsers() });
}
