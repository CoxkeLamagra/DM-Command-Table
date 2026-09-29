import { getV6Database } from "@/db/v6-sqlite";
import { handleV6Api } from "@/server/v6/api-router";
import { getV6User } from "@/server/v6/auth";
import { apiJson } from "@/server/v6/http";
import { rejectCrossOrigin } from "@/server/http/origin";
import { enforceV6RateLimit } from "@/server/v6/request-security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handle(request: Request): Promise<Response> {
  if (!["GET", "HEAD", "OPTIONS"].includes(request.method)) {
    const originError = rejectCrossOrigin(request);
    if (originError) return originError;
  }
  const database = getV6Database();
  const user = await getV6User(database);
  if (!user) return apiJson({ error: "Authentication required." }, 401);
  if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
    const pathname = new URL(request.url).pathname;
    const strictImport = pathname === "/api/v6/campaigns/import";
    const rateLimit = enforceV6RateLimit(
      database,
      request,
      strictImport ? "v6-import" : "v6-write",
      user.userId,
      strictImport ? 10 : 300,
      strictImport ? 60 * 60 * 1000 : 15 * 60 * 1000,
    );
    if (rateLimit) return rateLimit;
  }
  return handleV6Api(request, database, {
    userId: user.userId,
    isAdmin: user.isAdmin,
  });
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
