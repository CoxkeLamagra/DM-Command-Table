import { open } from "node:fs/promises";
import { Readable } from "node:stream";
import type { DatabaseSync } from "node:sqlite";
import { screenshotFile } from "./screenshots.ts";
// Authorize on every request, including conditional cache validation. Stream through a single file handle.
export async function screenshotResponse(
  database: DatabaseSync,
  id: string,
  userId: string,
  admin: boolean,
  request: Request,
): Promise<Response | null> {
  const file = screenshotFile(database, id, userId, admin);
  if (!file) return null;
  let handle;
  try {
    handle = await open(file.path, "r");
  } catch {
    return null;
  }
  try {
    const stat = await handle.stat();
    if (!stat.isFile()) {
      await handle.close();
      return null;
    }
    const etag = `"${id}-${stat.size}-${stat.mtimeMs}"`;
    const headers: Record<string, string> = {
      "content-type": file.mimeType,
      "cache-control": "private, no-cache",
      etag,
      "x-content-type-options": "nosniff",
      vary: "Cookie",
    };
    if (
      request.headers
        .get("if-none-match")
        ?.split(",")
        .some(
          (tag) =>
            tag.trim() === etag ||
            tag.trim() === `W/${etag}` ||
            tag.trim() === "*",
        )
    ) {
      await handle.close();
      return new Response(null, { status: 304, headers });
    }
    const stream = handle.createReadStream({ autoClose: true });
    const abort = () => stream.destroy();
    request.signal.addEventListener("abort", abort, { once: true });
    stream.once("close", () =>
      request.signal.removeEventListener("abort", abort),
    );
    if (request.signal.aborted) abort();
    headers["content-length"] = String(stat.size);
    return new Response(Readable.toWeb(stream) as ReadableStream<Uint8Array>, {
      headers,
    });
  } catch (error) {
    await handle.close().catch(() => undefined);
    throw error;
  }
}
