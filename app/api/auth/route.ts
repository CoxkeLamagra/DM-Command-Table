import { getDatabase } from "@/db/sqlite";
import { createSession, destroySession, findLocalUser, hashPassword, normaliseUsername, validateCredentials, verifyPassword } from "@/app/local-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Invalid request origin." }, { status: 403 });
  const body = await request.json().catch(() => null) as { action?: string; username?: string; password?: string; displayName?: string } | null;
  const action = body?.action;
  const username = normaliseUsername(body?.username ?? "");
  const password = body?.password ?? "";

  if (action === "logout") {
    await destroySession();
    return Response.json({ signedOut: true });
  }

  const validationError = validateCredentials(username, password);
  if (validationError) return Response.json({ error: validationError }, { status: 400 });

  if (action === "register") {
    const displayName = (body?.displayName ?? username).trim().slice(0, 80) || username;
    const db = getDatabase();
    if (findLocalUser(username)) return Response.json({ error: "That username is already registered." }, { status: 409 });
    const now = Date.now();
    const passwordHash = hashPassword(password);
    const localAccounts = db.prepare(
      "SELECT COUNT(*) AS count FROM users WHERE password_hash IS NOT NULL",
    ).get() as { count: number };
    const existingUsers = db.prepare("SELECT COUNT(*) AS count FROM users").get() as { count: number };
    const legacyUser = localAccounts.count === 0 && existingUsers.count === 1
      ? db.prepare("SELECT id FROM users LIMIT 1").get() as { id: string } | undefined
      : undefined;
    const id = legacyUser?.id ?? crypto.randomUUID();
    try {
      if (legacyUser) {
        db.prepare(
          "UPDATE users SET display_name = ?, username = ?, password_hash = ?, updated_at = ? WHERE id = ?",
        ).run(displayName, username, passwordHash, now, id);
      } else {
        db.prepare(
          "INSERT INTO users (id, email, display_name, username, password_hash, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
        ).run(id, `${username}@local.dm-command-table`, displayName, username, passwordHash, now);
      }
    } catch {
      return Response.json({ error: "That username is already registered." }, { status: 409 });
    }
    db.prepare(
      "UPDATE campaign_members SET user_id = ? WHERE user_id IS NULL AND invite_email = ?",
    ).run(id, username);
    await createSession(id);
    return Response.json({ user: { username, displayName } }, { status: 201 });
  }

  if (action === "login") {
    const user = findLocalUser(username);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return Response.json({ error: "Invalid username or password." }, { status: 401 });
    }
    await createSession(user.userId);
    return Response.json({ user: { username: user.username, displayName: user.displayName } });
  }

  return Response.json({ error: "Unsupported authentication action." }, { status: 400 });
}

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const requestHost = forwardedHost || request.headers.get("host");
  if (!requestHost) return false;
  try {
    return new URL(origin).host === requestHost;
  } catch {
    return false;
  }
}
