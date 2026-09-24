import { getLocalUser } from "@/server/auth/sessions";
import {
  isSupportedScreenshotType,
  listScreenshots,
  MAX_SCREENSHOT_BYTES,
  saveScreenshot,
} from "@/server/screenshots/repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getLocalUser();
  if (!user) return Response.json({ error: "Sign in required." }, { status: 401 });
  return Response.json({ screenshots: listScreenshots() });
}

export async function POST(request: Request) {
  if (!sameOrigin(request))
    return Response.json({ error: "Invalid request origin." }, { status: 403 });
  const user = await getLocalUser();
  if (!user) return Response.json({ error: "Sign in required." }, { status: 401 });
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

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  const requestHost =
    request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ||
    request.headers.get("host");
  if (!requestHost) return false;
  try {
    return new URL(origin).host === requestHost;
  } catch {
    return false;
  }
}
