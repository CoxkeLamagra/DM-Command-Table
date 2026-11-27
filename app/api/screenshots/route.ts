import { apiJson } from "@/server/http/http";
import { withApiUser } from "@/server/http/api-handler";
import { listScreenshots, saveScreenshot } from "@/server/media/screenshots";
import { readScreenshotUpload } from "@/server/media/screenshot-upload";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withApiUser(({ database, user }) =>
  apiJson({
    screenshots: listScreenshots(database, user.userId, user.isAdmin),
  }),
);

export const POST = withApiUser(
  async ({ request, database, user }) => {
    const upload = await readScreenshotUpload(database, request);
    return apiJson(
      {
        screenshot: await saveScreenshot(
          database,
          upload.file,
          user.userId,
          upload.deduplicateToken,
        ),
      },
      201,
    );
  },
  { rateLimit: "screenshotUpload" },
);
