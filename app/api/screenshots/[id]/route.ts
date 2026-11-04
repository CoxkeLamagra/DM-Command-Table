import { apiHandler } from "../../../../server/http/api-handler.ts";
import { screenshotResponse } from "@/server/media/screenshot-response";
import { getDatabase } from "@/db/sqlite";
import { rejectCrossOrigin } from "@/server/http/origin";
import { getUser } from "@/server/identity/auth";
import { apiJson } from "@/server/http/http";
import { enforceRateLimit } from "@/server/http/request-security";
import { deleteScreenshot } from "@/server/media/screenshots";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

async function handleGET(request: Request, { params }: Context) {
  const database = getDatabase();
  const user = await getUser(database);
  if (!user) return apiJson({ error: "Authentication required." }, 401);
  const limited = enforceRateLimit(
    database,
    request,
    "media-read",
    user.userId,
    1200,
    5 * 60 * 1000,
  );
  if (limited) return limited;
  const response = await screenshotResponse(
    database,
    (await params).id,
    user.userId,
    user.isAdmin,
    request,
  );
  return response ?? apiJson({ error: "Screenshot not found." }, 404);
}

async function handleDELETE(request: Request, { params }: Context) {
  const origin = rejectCrossOrigin(request);
  if (origin) return origin;
  const database = getDatabase();
  const user = await getUser(database);
  if (!user) return apiJson({ error: "Authentication required." }, 401);
  const limited = enforceRateLimit(
    database,
    request,
    "screenshot-delete",
    user.userId,
    60,
    60 * 60 * 1000,
  );
  if (limited) return limited;
  const result = await deleteScreenshot(
    database,
    (await params).id,
    user.userId,
    user.isAdmin,
  );
  if (result === "referenced")
    return apiJson(
      {
        error:
          "This screenshot is still used by campaign notes and cannot be deleted.",
      },
      409,
    );
  return result === "deleted"
    ? apiJson({ deleted: true })
    : apiJson({ error: "Screenshot not found." }, 404);
}

export const GET = apiHandler(handleGET);
export const DELETE = apiHandler(handleDELETE);

export const OPTIONS = apiHandler(
  () =>
    new Response(null, {
      status: 204,
      headers: { Allow: "GET, DELETE, HEAD, OPTIONS" },
    }),
);
