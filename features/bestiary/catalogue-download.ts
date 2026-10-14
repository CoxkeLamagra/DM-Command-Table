export const BESTIARY_BASE = "https://dnd5e.lamagra.link";

export function catalogueUrl(path: string): string {
  const url = new URL(path, BESTIARY_BASE);
  if (
    url.origin !== BESTIARY_BASE ||
    url.username ||
    url.password ||
    !(
      url.pathname === "/search/index.json" ||
      /^\/data\/bestiary\/(?:index|bestiary-[a-z0-9_-]+)\.json$/i.test(
        url.pathname,
      ) ||
      url.pathname.startsWith("/img/")
    )
  )
    throw new Error("Invalid catalogue URL.");
  return url.href;
}
export function fetchCatalogue(
  path: string,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<Response> {
  return fetch(catalogueUrl(path), {
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)])
      : AbortSignal.timeout(timeoutMs),
    credentials: "omit",
    referrerPolicy: "no-referrer",
    redirect: "error",
  });
}
/** Enforce actual streamed bytes, even when Content-Length is absent or misleading. */
export async function readCatalogueBody(
  response: Response,
  limit: number,
  acceptedTypes?: readonly string[],
): Promise<{ bytes: Uint8Array<ArrayBuffer>; type: string }> {
  const type =
    response.headers.get("content-type")?.split(";")[0].trim().toLowerCase() ??
    "";
  const reject = async (message: string): Promise<never> => {
    await response.body?.cancel().catch(() => undefined);
    throw new Error(message);
  };
  if (!response.ok) return reject("The remote catalogue could not be loaded.");
  if (!response.body)
    return reject("The remote catalogue returned an empty response.");
  if (acceptedTypes && !acceptedTypes.includes(type))
    return reject("Unsupported catalogue image type.");
  if (Number(response.headers.get("content-length")) > limit)
    return reject("Remote catalogue response is too large.");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0,
    complete = false;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        complete = true;
        break;
      }
      size += value.byteLength;
      if (size > limit)
        throw new Error("Remote catalogue response is too large.");
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return { bytes, type };
  } finally {
    if (!complete) await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
