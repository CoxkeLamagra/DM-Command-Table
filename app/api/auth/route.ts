import {
  findLocalUser,
  normaliseUsername,
  validateCredentials,
  verifyPassword,
} from "@/server/auth/credentials";
import { registerLocalUser } from "@/server/auth/registration";
import { createSession, destroySession } from "@/server/auth/sessions";
import { readJson, rejectCrossOrigin } from "@/server/http/requests";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const originError = rejectCrossOrigin(request);
  if (originError) return originError;
  const body = await readJson<{
    action?: string;
    username?: string;
    password?: string;
    displayName?: string;
  }>(request);
  const action = body?.action;
  const username = normaliseUsername(body?.username ?? "");
  const password = body?.password ?? "";

  if (action === "logout") {
    await destroySession();
    return Response.json({ signedOut: true });
  }

  const validationError = validateCredentials(username, password);
  if (validationError)
    return Response.json({ error: validationError }, { status: 400 });

  if (action === "register") {
    const displayName =
      (body?.displayName ?? username).trim().slice(0, 80) || username;
    const result = registerLocalUser({ username, displayName, password });
    if ("error" in result)
      return Response.json({ error: result.error }, { status: result.status });
    await createSession(result.user.userId);
    return Response.json(
      {
        user: {
          username: result.user.username,
          displayName: result.user.displayName,
          isAdmin: result.user.isAdmin,
        },
      },
      { status: 201 },
    );
  }

  if (action === "login") {
    const user = findLocalUser(username);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return Response.json(
        { error: "Invalid username or password." },
        { status: 401 },
      );
    }
    await createSession(user.userId);
    return Response.json({
      user: {
        username: user.username,
        displayName: user.displayName,
        isAdmin: Boolean(user.isAdmin),
      },
    });
  }

  return Response.json(
    { error: "Unsupported authentication action." },
    { status: 400 },
  );
}
