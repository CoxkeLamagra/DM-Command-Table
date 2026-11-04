import { apiHandler } from "../../../server/http/api-handler.ts";
import { withBodyActor } from "@/server/http/body-reader";
import { checkMultipartEnvelope } from "@/server/http/multipart";
import { getDatabase } from "@/db/sqlite";
import { rejectCrossOrigin } from "@/server/http/origin";
import { getUser } from "@/server/identity/auth";
import { PublicApiError } from "@/server/http/errors";
import { apiError, apiJson, boundedRequestBytes } from "@/server/http/http";
import { enforceRateLimit } from "@/server/http/request-security";
import { listScreenshots, saveScreenshot } from "@/server/media/screenshots";
import { getServerSettings } from "@/server/administration/server-settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handleGET(request: Request) {
  try {
    const database = getDatabase();
    const user = await getUser(database);
    if (!user) return apiJson({ error: "Authentication required." }, 401);
    const limited = enforceRateLimit(
      database,
      request,
      "media-list",
      user.userId,
      120,
      60_000,
    );
    if (limited) return limited;
    return apiJson({
      screenshots: listScreenshots(database, user.userId, user.isAdmin),
    });
  } catch (error) {
    return apiError(error);
  }
}

async function handlePOST(request: Request) {
  const origin = rejectCrossOrigin(request);
  if (origin) return origin;
  try {
    const database = getDatabase();
    const user = await getUser(database);
    if (!user) return apiJson({ error: "Authentication required." }, 401);
    const limited = enforceRateLimit(
      database,
      request,
      "screenshot-upload",
      user.userId,
      30,
      60 * 60 * 1000,
    );
    if (limited) return limited;
    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().startsWith("multipart/form-data;"))
      throw new PublicApiError(
        "Content-Type must be multipart/form-data.",
        415,
      );
    const contentLength = request.headers.get("content-length");
    if (!contentLength)
      return apiJson(
        { error: "A bounded Content-Length is required for uploads." },
        411,
      );
    const declared = Number(contentLength);
    const maximumBytes =
      getServerSettings(database).uploadLimitMb * 1024 * 1024;
    if (
      !Number.isSafeInteger(declared) ||
      declared < 1 ||
      declared > maximumBytes + 1024 * 1024
    )
      return apiJson({ error: "The upload is too large." }, 413);
    const bytes = await withBodyActor(user.userId, () =>
      boundedRequestBytes(request, maximumBytes + 1024 * 1024),
    );
    checkMultipartEnvelope(bytes, contentType);
    let form: FormData;
    try {
      form = await new Response(bytes as BodyInit, {
        headers: { "content-type": contentType },
      }).formData();
    } catch {
      throw new PublicApiError("Invalid multipart body.");
    }
    if (form.getAll("file").length !== 1)
      throw new PublicApiError("Upload exactly one image at a time.");
    if (
      [...form.keys()].some(
        (key) => key !== "file" && key !== "deduplicateToken",
      )
    )
      throw new PublicApiError(
        "The upload request contains unsupported fields.",
      );
    if (
      form.getAll("deduplicateToken").length > 1 ||
      (form.has("deduplicateToken") && form.get("deduplicateToken") !== "true")
    )
      throw new PublicApiError("Invalid token reuse option.");
    const file = form.get("file");
    if (!(file instanceof File))
      throw new PublicApiError("Select an image to upload.");
    return apiJson(
      {
        screenshot: await saveScreenshot(
          database,
          file,
          user.userId,
          form.get("deduplicateToken") === "true",
        ),
      },
      201,
    );
  } catch (error) {
    return apiError(error);
  }
}

export const GET = apiHandler(handleGET);
export const POST = apiHandler(handlePOST);

export const OPTIONS = apiHandler(
  () =>
    new Response(null, {
      status: 204,
      headers: { Allow: "GET, POST, HEAD, OPTIONS" },
    }),
);
