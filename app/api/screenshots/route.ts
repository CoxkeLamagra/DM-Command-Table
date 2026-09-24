import { authorizeRequest, rejectCrossOrigin } from "@/server/http/requests";
import {
  isSupportedScreenshotType,
  listScreenshots,
  MAX_SCREENSHOT_BYTES,
  saveScreenshot,
} from "@/server/screenshots/repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const authorization = await authorizeRequest();
  if ("response" in authorization) return authorization.response;
  return Response.json({ screenshots: listScreenshots() });
}

export async function POST(request: Request) {
  const originError = rejectCrossOrigin(request);
  if (originError) return originError;
  const authorization = await authorizeRequest();
  if ("response" in authorization) return authorization.response;
  const { user } = authorization;
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File))
    return Response.json({ error: "Select an image to upload." }, { status: 400 });
  if (!isSupportedScreenshotType(file.type))
    return Response.json(
      { error: "Only PNG, JPEG, WebP, and GIF images are supported." },
      { status: 415 },
    );
  if (file.size < 1 || file.size > MAX_SCREENSHOT_BYTES)
    return Response.json(
      { error: "Screenshots must be no larger than 8 MB." },
      { status: 413 },
    );
  const screenshot = await saveScreenshot(file, user.userId);
  return Response.json({ screenshot }, { status: 201 });
}
