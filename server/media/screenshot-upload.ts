import type { DatabaseSync } from "node:sqlite";
import { getServerSettings } from "../administration/server-settings.ts";
import { PublicApiError } from "../http/errors.ts";
import { boundedRequestBytes } from "../http/http.ts";

const MULTIPART_OVERHEAD_BYTES = 1024 * 1024;

/**
 * Reads one bounded multipart image upload: a single `file` field plus an
 * optional `deduplicateToken=true`. Rejects before buffering when the declared
 * size exceeds the configured upload limit.
 */
export async function readScreenshotUpload(
  database: DatabaseSync,
  request: Request,
): Promise<{ file: File; deduplicateToken: boolean }> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("multipart/form-data;"))
    throw new PublicApiError("Content-Type must be multipart/form-data.", 415);
  const contentLength = request.headers.get("content-length");
  if (!contentLength)
    throw new PublicApiError(
      "A bounded Content-Length is required for uploads.",
      411,
    );
  const declared = Number(contentLength);
  const maximumBytes =
    getServerSettings(database).uploadLimitMb * 1024 * 1024 +
    MULTIPART_OVERHEAD_BYTES;
  if (
    !Number.isSafeInteger(declared) ||
    declared < 1 ||
    declared > maximumBytes
  )
    throw new PublicApiError("The upload is too large.", 413);
  const bytes = await boundedRequestBytes(request, maximumBytes);
  const form = await new Response(bytes as BodyInit, {
    headers: { "content-type": contentType },
  }).formData();
  if (form.getAll("file").length !== 1)
    throw new PublicApiError("Upload exactly one image at a time.");
  if (
    [...form.keys()].some((key) => key !== "file" && key !== "deduplicateToken")
  )
    throw new PublicApiError("The upload request contains unsupported fields.");
  if (
    form.getAll("deduplicateToken").length > 1 ||
    (form.has("deduplicateToken") && form.get("deduplicateToken") !== "true")
  )
    throw new PublicApiError("Invalid token reuse option.");
  const file = form.get("file");
  if (!(file instanceof File))
    throw new PublicApiError("Select an image to upload.");
  return { file, deduplicateToken: form.get("deduplicateToken") === "true" };
}
