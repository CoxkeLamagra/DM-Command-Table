import { z } from "zod";
import { catalogueIdentity, parseCatalogue } from "./local-catalogue.ts";
import type { FiveEToolsMonster } from "./fiveetools.ts";

import { fetchCatalogue, readCatalogueBody } from "./catalogue-download.ts";
export { BESTIARY_BASE } from "./catalogue-download.ts";
export type RemoteMonsterRef = { name: string; source: string; file: string };
const filename = z.string().regex(/^bestiary-[a-z0-9_-]+\.json$/i);
async function download(path: string, signal?: AbortSignal): Promise<string> {
  const response = await fetchCatalogue(path, 15000, signal);
  const { bytes } = await readCatalogueBody(response, 32 * 1024 * 1024);
  return new TextDecoder().decode(bytes);
}

export async function loadRemoteCatalogue(
  signal?: AbortSignal,
): Promise<RemoteMonsterRef[]> {
  const [searchText, indexText] = await Promise.all([
    download("/search/index.json", signal),
    download("/data/bestiary/index.json", signal),
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
        ? { name: item.n!, source, file: index[source] }
        : null;
    })
    .filter((item): item is RemoteMonsterRef => Boolean(item));
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
  for (const file of new Set(matches.map((item) => item.file))) {
    filename.parse(file);
    if (!cache.has(file)) {
      const monsters = parseCatalogue(
        await download(`/data/bestiary/${file}`, signal),
      );
      signal?.throwIfAborted();
      if (cache.size >= 64) cache.delete(cache.keys().next().value!);
      cache.set(file, monsters);
    }
  }
  signal?.throwIfAborted();
  return matches
    .map((item) =>
      cache
        .get(item.file)
        ?.find(
          (monster) => catalogueIdentity(monster) === catalogueIdentity(item),
        ),
    )
    .filter((item): item is FiveEToolsMonster => Boolean(item));
}
