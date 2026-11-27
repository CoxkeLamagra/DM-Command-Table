import { z } from "zod";
import { catalogueIdentity, parseCatalogue } from "./local-catalogue.ts";
import type { FiveEToolsMonster } from "./fiveetools.ts";

import {
  BESTIARY_BASE,
  fetchCatalogue,
  readCatalogueBody,
  rememberCatalogueBase,
  type CatalogueBase,
} from "./catalogue-download.ts";
export { BESTIARY_BASE, FALLBACK_BESTIARY_BASE } from "./catalogue-download.ts";
export type RemoteMonsterRef = {
  name: string;
  source: string;
  file: string;
  /** Site the reference was indexed from; the primary catalogue when absent. */
  base?: CatalogueBase;
};
const filename = z.string().regex(/^bestiary-[a-z0-9_-]+\.json$/i);
async function download(
  path: string,
  base: CatalogueBase,
  signal?: AbortSignal,
): Promise<string> {
  const response = await fetchCatalogue(path, 15000, signal, base);
  const { bytes } = await readCatalogueBody(response, 32 * 1024 * 1024);
  return new TextDecoder().decode(bytes);
}

export async function loadRemoteCatalogue(
  signal?: AbortSignal,
  base: CatalogueBase = BESTIARY_BASE,
): Promise<RemoteMonsterRef[]> {
  const [searchText, indexText] = await Promise.all([
    download("/search/index.json", base, signal),
    download("/data/bestiary/index.json", base, signal),
  ]);
  const search = z
    .object({
      m: z.object({ s: z.record(z.string(), z.number().int()) }),
      x: z.array(
        z.object({
          c: z.number(),
          n: z.string().optional(),
          s: z.union([z.number(), z.string()]).optional(),
        }),
      ),
    })
    .parse(JSON.parse(searchText));
  const index = z.record(z.string(), filename).parse(JSON.parse(indexText));
  const sources = new Map(
    Object.entries(search.m.s).map(([source, id]) => [id, source]),
  );
  const references = search.x
    .filter((item) => item.c === 1 && item.n)
    .map((item) => {
      const source =
        typeof item.s === "string" ? item.s : sources.get(item.s ?? -1);
      return source && index[source]
        ? { name: item.n!, source, file: index[source], base }
        : null;
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
  return [
    ...new Map(
      references.map((item) => [catalogueIdentity(item), item]),
    ).values(),
  ];
}
export async function searchRemoteCatalogue(
  query: string,
  catalogue: RemoteMonsterRef[],
  cache: Map<string, FiveEToolsMonster[]>,
  signal?: AbortSignal,
): Promise<FiveEToolsMonster[]> {
  const term = query.trim().toLowerCase();
  if (term.length < 2) return [];
  const matches = catalogue
    .filter((item) =>
      `${item.name} ${item.source}`.toLowerCase().includes(term),
    )
    .slice(0, 50);
  const cacheKey = (item: RemoteMonsterRef) =>
    item.base && item.base !== BESTIARY_BASE
      ? `${item.base}/${item.file}`
      : item.file;
  const files = new Map(matches.map((item) => [cacheKey(item), item]));
  for (const [key, item] of files) {
    filename.parse(item.file);
    if (!cache.has(key)) {
      const base = item.base ?? BESTIARY_BASE;
      const monsters = parseCatalogue(
        await download(`/data/bestiary/${item.file}`, base, signal),
      );
      signal?.throwIfAborted();
      for (const monster of monsters) rememberCatalogueBase(monster, base);
      if (cache.size >= 64) cache.delete(cache.keys().next().value!);
      cache.set(key, monsters);
    }
  }
  signal?.throwIfAborted();
  return matches
    .map((item) =>
      cache
        .get(cacheKey(item))
        ?.find(
          (monster) => catalogueIdentity(monster) === catalogueIdentity(item),
        ),
    )
    .filter((item): item is FiveEToolsMonster => Boolean(item));
}

/**
 * Search the primary catalogue first. When it has no match, or its files
 * cannot be downloaded, search the fallback catalogue instead. The fallback
 * index is only loaded when it is needed.
 */
export async function searchRemoteCatalogues(
  query: string,
  primary: RemoteMonsterRef[],
  loadFallback: () => Promise<RemoteMonsterRef[]>,
  cache: Map<string, FiveEToolsMonster[]>,
  signal?: AbortSignal,
): Promise<FiveEToolsMonster[]> {
  if (query.trim().length < 2) return [];
  let primaryError: unknown;
  if (primary.length) {
    try {
      const found = await searchRemoteCatalogue(query, primary, cache, signal);
      if (found.length) return found;
    } catch (error) {
      signal?.throwIfAborted();
      primaryError = error;
    }
  }
  let fallback: RemoteMonsterRef[];
  try {
    fallback = await loadFallback();
  } catch (error) {
    signal?.throwIfAborted();
    // Nothing found on the primary site: report its failure if it had one,
    // otherwise an unreachable fallback simply means no results.
    if (primaryError || !primary.length) throw primaryError ?? error;
    return [];
  }
  signal?.throwIfAborted();
  let found: FiveEToolsMonster[];
  try {
    found = await searchRemoteCatalogue(query, fallback, cache, signal);
  } catch (error) {
    signal?.throwIfAborted();
    throw primaryError ?? error;
  }
  if (!found.length && primaryError) throw primaryError;
  return found;
}
