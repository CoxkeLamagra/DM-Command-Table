import { authorizeRequest, rejectCrossOrigin } from "@/server/http/requests";
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
  const authorization = await authorizeRequest();
  if ("response" in authorization) return authorization.response;
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
  const originError = rejectCrossOrigin(request);
  if (originError) return originError;
  const authorization = await authorizeRequest({ admin: true });
  if ("response" in authorization) return authorization.response;
  if (!(await deleteScreenshot((await context.params).id)))
    return Response.json({ error: "Screenshot not found." }, { status: 404 });
  return Response.json({ deleted: true });
}
