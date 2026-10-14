import type { FiveEToolsMonster } from "./fiveetools";

const BASE = "https://dnd5e.lamagra.link";
const cache = new Map<string, Promise<Blob | null>>();
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
      const url = new URL(href, BASE);
      if (url.origin === BASE && url.pathname.startsWith("/img/"))
        return url.href;
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
  if (!cache.has(url)) {
    if (cache.size >= 64) cache.delete(cache.keys().next().value!);
    cache.set(
      url,
      (async () => {
        try {
          const parsed = new URL(url);
          if (parsed.origin !== BASE || !parsed.pathname.startsWith("/img/"))
            return null;
          const response = await fetch(url, {
            credentials: "omit",
            referrerPolicy: "no-referrer",
            redirect: "error",
            signal: AbortSignal.timeout(10000),
          });
          if (!response.ok || !response.body) return null;
          const type = response.headers.get("content-type")?.split(";")[0];
          if (
            !type ||
            !["image/webp", "image/png", "image/jpeg"].includes(type)
          )
            return null;
          const reader = response.body.getReader();
          const chunks: Uint8Array[] = [];
          let bytes = 0;
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              bytes += value.byteLength;
              if (bytes > 2 * 1024 * 1024) {
                await reader.cancel();
                return null;
              }
              chunks.push(value);
            }
          } finally {
            reader.releaseLock();
          }
          return new Blob(chunks as BlobPart[], { type });
        } catch {
          return null;
        }
      })(),
    );
  }
  return cache.get(url)!;
}
