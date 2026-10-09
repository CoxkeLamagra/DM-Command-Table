import { z } from "zod";
import { getDatabase } from "@/db/sqlite";
import { rejectCrossOrigin } from "@/server/http/origin";
import {
  authenticateUser,
  createSession,
  destroySession,
  getUser,
  registerUser,
  registrationStatus,
} from "@/server/identity/auth";
import { apiError, apiJson, jsonBody } from "@/server/http/http";
import { clientAddress, rateLimitResponse } from "@/server/security/rate-limit";
import { consumePersistentRateLimit } from "@/server/security/sqlite-rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const authSchema = z.object({
  action: z.enum(["login", "register", "logout"]),
  username: z.string().max(32).optional(),
  password: z.string().max(128).optional(),
  displayName: z.string().max(80).optional(),
  bootstrapToken: z.string().max(512).optional(),
});

export async function GET() {
  const database = getDatabase();
  const user = await getUser(database);
  return apiJson({ user, ...registrationStatus(database) });
}

export async function POST(request: Request) {
  const originError = rejectCrossOrigin(request);
  if (originError) return originError;
  try {
    const input = authSchema.parse(await jsonBody(request, 8192));
    const database = getDatabase();
    if (input.action === "logout") {
      await destroySession(database);
      return apiJson({ signedOut: true });
    }
    const globalLimit = consumePersistentRateLimit(
      database,
      `auth:${input.action}:global`,
      input.action === "login" ? 300 : 30,
      input.action === "login" ? 15 * 60 * 1000 : 60 * 60 * 1000,
    );
    if (!globalLimit.allowed)
      return rateLimitResponse(globalLimit.retryAfterSeconds);
    const rateLimit = consumePersistentRateLimit(
      database,
      `auth:${input.action}:${clientAddress(request)}:${(input.username ?? "").toLowerCase()}`,
      input.action === "login" ? 10 : 5,
      input.action === "login" ? 15 * 60 * 1000 : 60 * 60 * 1000,
    );
    if (!rateLimit.allowed)
      return rateLimitResponse(rateLimit.retryAfterSeconds);
    if (input.action === "register") {
      const user = await registerUser(database, {
        username: input.username ?? "",
        displayName: input.displayName ?? input.username ?? "",
        password: input.password ?? "",
        bootstrapToken: input.bootstrapToken,
      });
      await createSession(user.userId, database);
      return apiJson({ user }, 201);
    }
    const user = await authenticateUser(
      database,
      input.username ?? "",
      input.password ?? "",
    );
    if (!user) return apiJson({ error: "Invalid username or password." }, 401);
    await createSession(user.userId, database);
    return apiJson({ user });
  } catch (error) {
    return apiError(error);
  }
}
