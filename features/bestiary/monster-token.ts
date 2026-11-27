import type { FiveEToolsMonster } from "./fiveetools";

import {
  BESTIARY_BASE as BASE,
  catalogueUrl,
  fetchCatalogue,
  readCatalogueBody,
} from "./catalogue-download.ts";
type CachedToken = { promise: Promise<Blob | null>; size: number };
const cache = new Map<string, CachedToken>();
let cachedBytes = 0;
function evict(url: string) {
  cachedBytes -= cache.get(url)?.size ?? 0;
  cache.delete(url);
}
export function catalogueTokenUrl(
  monster: FiveEToolsMonster,
): string | undefined {
  if (monster.tokenUrl || monster.tokenHref) {
    const href =
      monster.tokenUrl ??
      monster.tokenHref?.url ??
      (monster.tokenHref?.path ? `/img/${monster.tokenHref.path}` : undefined);
    if (!href) return;
    try {
      const url = catalogueUrl(href);
      if (new URL(url).pathname.startsWith("/img/")) return url;
    } catch {
      /* Invalid catalogue metadata has no image. */
    }
    return;
  }
  if (!monster.hasToken && !monster.token) return;
  const source = monster.token?.source ?? monster.source;
  const name = (monster.token?.name ?? monster.name)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/"/g, "");
  return `${BASE}/img/bestiary/tokens/${encodeURIComponent(source)}/${encodeURIComponent(name)}.webp`;
}
export function downloadMonsterToken(url: string): Promise<Blob | null> {
  const cached = cache.get(url);
  if (cached) return cached.promise;
  if (cache.size >= 32) evict(cache.keys().next().value!);
  const entry: CachedToken = { promise: Promise.resolve(null), size: 0 };
  entry.promise = (async () => {
    try {
      const parsed = new URL(catalogueUrl(url));
      if (!parsed.pathname.startsWith("/img/")) return null;
      const response = await fetchCatalogue(url, 10000);
      const { bytes, type } = await readCatalogueBody(
        response,
        2 * 1024 * 1024,
        ["image/webp", "image/png", "image/jpeg"],
      );
      return new Blob([bytes], { type });
    } catch {
      return null;
    }
  })().then((blob) => {
    if (cache.get(url) === entry) {
      if (!blob)
        evict(url); // Transient failures remain retryable.
      else {
        entry.size = blob.size;
        cachedBytes += blob.size;
        while (cachedBytes > 16 * 1024 * 1024)
          evict(cache.keys().next().value!);
      }
    }
    return blob;
  });
  cache.set(url, entry);
  return entry.promise;
}
