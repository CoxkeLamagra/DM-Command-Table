import { parseApiRoute } from "@/server/http/api-route";
import { withPackageWork } from "@/server/http/package-work";
import { handleApi } from "@/server/api/api-router";
import { withApiUser } from "@/server/http/api-handler";
import { rateLimited } from "@/server/http/request-security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const handle = withApiUser(async ({ request, database, user }) => {
  const route = parseApiRoute(new URL(request.url).pathname);
  if (!["GET", "HEAD", "OPTIONS"].includes(request.method)) {
    const limited = rateLimited(
      database,
      request,
      route.isImport ? "import" : "write",
      user.userId,
    );
    if (limited) return limited;
  }
  const operation = () =>
    handleApi(
      request,
      database,
      { userId: user.userId, isAdmin: user.isAdmin },
      route,
    );
  return route.isPackageWork ? withPackageWork(operation) : operation();
});

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
