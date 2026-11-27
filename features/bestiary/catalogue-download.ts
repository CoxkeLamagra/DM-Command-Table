export const BESTIARY_BASE = "https://dnd5e.lamagra.link";
/** Searched when the primary catalogue has no match or cannot be reached. */
export const FALLBACK_BESTIARY_BASE = "https://5e.tools";
export const CATALOGUE_BASES = [BESTIARY_BASE, FALLBACK_BESTIARY_BASE] as const;
export type CatalogueBase = (typeof CATALOGUE_BASES)[number];

// Remembers which site a downloaded monster came from, so its token is
// fetched from that same site.
const monsterBases = new WeakMap<object, CatalogueBase>();
export function rememberCatalogueBase(
  monster: object,
  base: CatalogueBase,
): void {
  monsterBases.set(monster, base);
}
export function catalogueBaseOf(monster: object): CatalogueBase {
  return monsterBases.get(monster) ?? BESTIARY_BASE;
}

export function catalogueUrl(
  path: string,
  base: CatalogueBase = BESTIARY_BASE,
): string {
  const url = new URL(path, base);
  if (
    !(CATALOGUE_BASES as readonly string[]).includes(url.origin) ||
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
  base: CatalogueBase = BESTIARY_BASE,
): Promise<Response> {
  return fetch(catalogueUrl(path, base), {
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
