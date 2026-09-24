import { getLocalUser } from "@/server/auth/sessions";
import {
  deleteScreenshot,
  readScreenshot,
} from "@/server/screenshots/repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getLocalUser();
  if (!user) return Response.json({ error: "Sign in required." }, { status: 401 });
  const screenshot = await readScreenshot((await context.params).id);
  if (!screenshot)
    return Response.json({ error: "Screenshot not found." }, { status: 404 });
  return new Response(new Uint8Array(screenshot.bytes), {
    headers: {
      "content-type": screenshot.mimeType,
      "cache-control": "private, max-age=300",
      "x-content-type-options": "nosniff",
    },
  });
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!sameOrigin(request))
    return Response.json({ error: "Invalid request origin." }, { status: 403 });
  const user = await getLocalUser();
  if (!user) return Response.json({ error: "Sign in required." }, { status: 401 });
  if (!user.isAdmin)
    return Response.json({ error: "Administrator access required." }, { status: 403 });
  if (!(await deleteScreenshot((await context.params).id)))
    return Response.json({ error: "Screenshot not found." }, { status: 404 });
  return Response.json({ deleted: true });
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
