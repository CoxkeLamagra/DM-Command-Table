import { getV6Database } from "@/db/v6-sqlite";
import { rejectCrossOrigin } from "@/server/http/origin";
import { getV6User } from "@/server/v6/auth";
import { apiJson } from "@/server/v6/http";
import { enforceV6RateLimit } from "@/server/v6/request-security";
import { deleteV6Screenshot, readV6Screenshot } from "@/server/v6/screenshots";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Context) {
  const database = getV6Database();
  const user = await getV6User(database);
  if (!user) return apiJson({ error: "Authentication required." }, 401);
  const screenshot = await readV6Screenshot(
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
  const database = getV6Database();
  const user = await getV6User(database);
  if (!user) return apiJson({ error: "Authentication required." }, 401);
  const limited = enforceV6RateLimit(
    database,
    request,
    "v6-screenshot-delete",
    user.userId,
    60,
    60 * 60 * 1000,
  );
  if (limited) return limited;
  const result = await deleteV6Screenshot(
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
