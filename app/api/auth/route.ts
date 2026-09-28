import {
  findLocalUser,
  normaliseUsername,
  validateCredentials,
  verifyPassword,
} from "@/server/auth/credentials";
import { registerLocalUser } from "@/server/auth/registration";
import { createSession, destroySession } from "@/server/auth/sessions";
import { readJson, rejectCrossOrigin } from "@/server/http/requests";
import {
  clientAddress,
  consumeRateLimit,
  rateLimitResponse,
} from "@/server/security/rate-limit";
import { getRegistrationStatus } from "@/server/admin/registration-settings";
import { privateJson } from "@/server/http/responses";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return privateJson(getRegistrationStatus());
}

export async function POST(request: Request) {
  const originError = rejectCrossOrigin(request);
  if (originError) return originError;
  const body = await readJson<{
    action?: string;
    username?: string;
    password?: string;
    displayName?: string;
    bootstrapToken?: string;
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
    const globalRateLimit = consumeRateLimit(
      "register:global",
      30,
      60 * 60 * 1000,
    );
    if (!globalRateLimit.allowed)
      return rateLimitResponse(globalRateLimit.retryAfterSeconds);
    const rateLimit = consumeRateLimit(
      `register:${clientAddress(request)}`,
      5,
      60 * 60 * 1000,
    );
    if (!rateLimit.allowed)
      return rateLimitResponse(rateLimit.retryAfterSeconds);
    const registrationError = registrationPolicyError(body?.bootstrapToken);
    if (registrationError) return registrationError;
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
    const globalRateLimit = consumeRateLimit(
      "login:global",
      300,
      15 * 60 * 1000,
    );
    if (!globalRateLimit.allowed)
      return rateLimitResponse(globalRateLimit.retryAfterSeconds);
    const rateLimit = consumeRateLimit(
      `login:${clientAddress(request)}:${username}`,
      10,
      15 * 60 * 1000,
    );
    if (!rateLimit.allowed)
      return rateLimitResponse(rateLimit.retryAfterSeconds);
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

function registrationPolicyError(bootstrapToken?: string): Response | null {
  const { initialSetup, registrationEnabled } = getRegistrationStatus();
  const configuredToken = process.env.DM_COMMAND_TABLE_BOOTSTRAP_TOKEN;
  if (initialSetup) {
    if (process.env.NODE_ENV === "production" && !configuredToken) {
      return Response.json(
        { error: "Registration is not configured. Set DM_COMMAND_TABLE_BOOTSTRAP_TOKEN on the server first." },
        { status: 503 },
      );
    }
    if (configuredToken && bootstrapToken !== configuredToken) {
      return Response.json({ error: "The bootstrap token is incorrect." }, { status: 403 });
    }
    return null;
  }
  if (!registrationEnabled) {
    return Response.json(
      { error: "New account registration is disabled by the administrator." },
      { status: 403 },
    );
  }
  return null;
}
