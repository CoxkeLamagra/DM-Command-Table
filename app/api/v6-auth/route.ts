import { z } from "zod";
import { getV6Database } from "@/db/v6-sqlite";
import { rejectCrossOrigin } from "@/server/http/origin";
import {
  authenticateV6User,
  createV6Session,
  destroyV6Session,
  getV6User,
  registerV6User,
  registrationStatus,
} from "@/server/v6/auth";
import { apiError, apiJson, jsonBody } from "@/server/v6/http";
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
  const database = getV6Database();
  const user = await getV6User(database);
  return apiJson({ user, ...registrationStatus(database) });
}

export async function POST(request: Request) {
  const originError = rejectCrossOrigin(request);
  if (originError) return originError;
  try {
    const input = authSchema.parse(await jsonBody(request, 8192));
    const database = getV6Database();
    if (input.action === "logout") {
      await destroyV6Session(database);
      return apiJson({ signedOut: true });
    }
    const globalLimit = consumePersistentRateLimit(
      database,
      `v6-auth:${input.action}:global`,
      input.action === "login" ? 300 : 30,
      input.action === "login" ? 15 * 60 * 1000 : 60 * 60 * 1000,
    );
    if (!globalLimit.allowed)
      return rateLimitResponse(globalLimit.retryAfterSeconds);
    const rateLimit = consumePersistentRateLimit(
      database,
      `v6-auth:${input.action}:${clientAddress(request)}:${(input.username ?? "").toLowerCase()}`,
      input.action === "login" ? 10 : 5,
      input.action === "login" ? 15 * 60 * 1000 : 60 * 60 * 1000,
    );
    if (!rateLimit.allowed)
      return rateLimitResponse(rateLimit.retryAfterSeconds);
    if (input.action === "register") {
      const user = await registerV6User(database, {
        username: input.username ?? "",
        displayName: input.displayName ?? input.username ?? "",
        password: input.password ?? "",
        bootstrapToken: input.bootstrapToken,
      });
      await createV6Session(user.userId, database);
      return apiJson({ user }, 201);
    }
    const user = await authenticateV6User(
      database,
      input.username ?? "",
      input.password ?? "",
    );
    if (!user) return apiJson({ error: "Invalid username or password." }, 401);
    await createV6Session(user.userId, database);
    return apiJson({ user });
  } catch (error) {
    return apiError(error);
  }
}
