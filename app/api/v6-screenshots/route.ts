import { getV6Database } from "@/db/v6-sqlite";
import { rejectCrossOrigin } from "@/server/http/origin";
import { getV6User } from "@/server/v6/auth";
import { PublicApiError } from "@/server/v6/errors";
import { apiError, apiJson } from "@/server/v6/http";
import { enforceV6RateLimit } from "@/server/v6/request-security";
import { listV6Screenshots, saveV6Screenshot } from "@/server/v6/screenshots";
import { getV6ServerSettings } from "@/server/v6/server-settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const database = getV6Database();
  const user = await getV6User(database);
  if (!user) return apiJson({ error: "Authentication required." }, 401);
  return apiJson({
    screenshots: listV6Screenshots(database, user.userId, user.isAdmin),
  });
}

export async function POST(request: Request) {
  const origin = rejectCrossOrigin(request);
  if (origin) return origin;
  try {
    const database = getV6Database();
    const user = await getV6User(database);
    if (!user) return apiJson({ error: "Authentication required." }, 401);
    const limited = enforceV6RateLimit(
      database,
      request,
      "v6-screenshot-upload",
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
      getV6ServerSettings(database).uploadLimitMb * 1024 * 1024;
    if (
      !Number.isSafeInteger(declared) ||
      declared < 1 ||
      declared > maximumBytes + 1024 * 1024
    )
      return apiJson({ error: "The upload is too large." }, 413);
    const form = await request.formData();
    if ([...form.keys()].some((key) => key !== "file"))
      throw new PublicApiError(
        "The upload request contains unsupported fields.",
      );
    const file = form.get("file");
    if (!(file instanceof File))
      throw new PublicApiError("Select an image to upload.");
    return apiJson(
      { screenshot: await saveV6Screenshot(database, file, user.userId) },
      201,
    );
  } catch (error) {
    return apiError(error);
  }
}
