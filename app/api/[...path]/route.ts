import { apiHandler } from "../../../server/http/api-handler.ts";
import { withBodyActor } from "@/server/http/body-reader";
import { parseApiRoute } from "@/server/http/api-route";
import { withPackageWork } from "@/server/http/package-work";
import { getDatabase } from "@/db/sqlite";
import { handleApi } from "@/server/api/api-router";
import { getUser } from "@/server/identity/auth";
import { apiJson, apiError } from "@/server/http/http";
import { rejectCrossOrigin } from "@/server/http/origin";
import { enforceRateLimit } from "@/server/http/request-security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handle(request: Request): Promise<Response> {
  if (!["GET", "HEAD", "OPTIONS"].includes(request.method)) {
    const originError = rejectCrossOrigin(request);
    if (originError) return originError;
  }
  const database = getDatabase();
  const user = await getUser(database);
  if (!user) return apiJson({ error: "Authentication required." }, 401);
  let route;
  try {
    route = parseApiRoute(new URL(request.url).pathname);
  } catch (error) {
    return apiError(error);
  }
  if (!["GET", "HEAD", "OPTIONS"].includes(request.method)) {
    const strictImport = route.isImport;
    const rateLimit = enforceRateLimit(
      database,
      request,
      strictImport ? "import" : "write",
      user.userId,
      strictImport ? 10 : 300,
      strictImport ? 60 * 60 * 1000 : 15 * 60 * 1000,
    );
    if (rateLimit) return rateLimit;
  }
  if (request.method === "GET") {
    const limited = enforceRateLimit(
      database,
      request,
      "read",
      user.userId,
      1200,
      5 * 60 * 1000,
    );
    if (limited) return limited;
    const expensive = route.isPackageWork || route.segments[2] === "export";
    if (expensive) {
      const limited = enforceRateLimit(
        database,
        request,
        "export",
        user.userId,
        10,
        60_000,
      );
      if (limited) return limited;
    }
  }
  const operation = () =>
    withBodyActor(user.userId, () =>
      handleApi(
        request,
        database,
        {
          userId: user.userId,
          isAdmin: user.isAdmin,
        },
        route,
      ),
    );
  try {
    return route.isPackageWork
      ? await withPackageWork(operation)
      : await operation();
  } catch (error) {
    return apiError(error);
  }
}

export const GET = apiHandler(handle);
export const POST = apiHandler(handle);
export const PUT = apiHandler(handle);
export const PATCH = apiHandler(handle);
export const DELETE = apiHandler(handle);

export const OPTIONS = apiHandler(
  () =>
    new Response(null, {
      status: 204,
      headers: { Allow: "GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS" },
    }),
);
