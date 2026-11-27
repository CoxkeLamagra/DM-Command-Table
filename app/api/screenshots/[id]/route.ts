import { screenshotResponse } from "@/server/media/screenshot-response";
import { apiJson } from "@/server/http/http";
import { withApiUser } from "@/server/http/api-handler";
import { deleteScreenshot } from "@/server/media/screenshots";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export const GET = withApiUser(
  async ({ request, database, user }, { params }: Context) => {
    const response = await screenshotResponse(
      database,
      (await params).id,
      user.userId,
      user.isAdmin,
      request,
    );
    return response ?? apiJson({ error: "Screenshot not found." }, 404);
  },
);

export const DELETE = withApiUser(
  async ({ database, user }, { params }: Context) => {
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
  },
  { rateLimit: "screenshotDelete" },
);
