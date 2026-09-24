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
import { getLocalUser } from "@/server/auth/sessions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getLocalUser();
  if (!user) return Response.json({ error: "Sign in required." }, { status: 401 });
  if (!user.isAdmin)
    return Response.json({ error: "Administrator access required." }, { status: 403 });
  return Response.json({ users: listUsers() });
}

export async function PATCH(request: Request) {
  if (!sameOrigin(request))
    return Response.json({ error: "Invalid request origin." }, { status: 403 });
  const user = await getLocalUser();
  if (!user) return Response.json({ error: "Sign in required." }, { status: 401 });
  if (!user.isAdmin)
    return Response.json({ error: "Administrator access required." }, { status: 403 });
  const body = (await request.json().catch(() => null)) as {
    action?: string;
    id?: string;
    username?: string;
    displayName?: string;
    password?: string;
    isAdmin?: boolean;
  } | null;
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
  if (!sameOrigin(request))
    return Response.json({ error: "Invalid request origin." }, { status: 403 });
  const user = await getLocalUser();
  if (!user) return Response.json({ error: "Sign in required." }, { status: 401 });
  if (!user.isAdmin)
    return Response.json({ error: "Administrator access required." }, { status: 403 });
  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!id) return Response.json({ error: "A user is required." }, { status: 400 });
  if (id === user.userId)
    return Response.json({ error: "You cannot delete your own account." }, { status: 400 });
  if (!deleteUser(id))
    return Response.json({ error: "User not found." }, { status: 404 });
  return Response.json({ users: listUsers() });
}

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  const requestHost =
    request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ||
    request.headers.get("host");
  if (!requestHost) return false;
  try {
    return new URL(origin).host === requestHost;
  } catch {
    return false;
  }
}
