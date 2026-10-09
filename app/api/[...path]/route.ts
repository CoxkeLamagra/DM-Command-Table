import { getDatabase } from "@/db/sqlite";
import { handleApi } from "@/server/api/api-router";
import { getUser } from "@/server/identity/auth";
import { apiJson } from "@/server/http/http";
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
  if (!["GET", "HEAD", "OPTIONS"].includes(request.method)) {
    const pathname = new URL(request.url).pathname;
    const strictImport = pathname === "/api/campaigns/import";
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
  return handleApi(request, database, {
    userId: user.userId,
    isAdmin: user.isAdmin,
  });
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
