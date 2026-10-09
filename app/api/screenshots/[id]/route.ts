import { getDatabase } from "@/db/sqlite";
import { rejectCrossOrigin } from "@/server/http/origin";
import { getUser } from "@/server/identity/auth";
import { apiJson } from "@/server/http/http";
import { enforceRateLimit } from "@/server/http/request-security";
import { deleteScreenshot, readScreenshot } from "@/server/media/screenshots";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Context) {
  const database = getDatabase();
  const user = await getUser(database);
  if (!user) return apiJson({ error: "Authentication required." }, 401);
  const screenshot = await readScreenshot(
    database,
    (await params).id,
    user.userId,
    user.isAdmin,
  );
  if (!screenshot) return apiJson({ error: "Screenshot not found." }, 404);
  return new Response(new Uint8Array(screenshot.bytes), {
    headers: {
      "content-type": screenshot.mimeType,
      "cache-control": "private, max-age=300",
      "x-content-type-options": "nosniff",
      vary: "Cookie",
    },
  });
}

export async function DELETE(request: Request, { params }: Context) {
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
