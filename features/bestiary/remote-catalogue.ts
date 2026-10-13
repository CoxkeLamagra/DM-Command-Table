import { z } from "zod";
import { catalogueIdentity, parseCatalogue } from "./local-catalogue.ts";
import type { FiveEToolsMonster } from "./fiveetools.ts";

export const BESTIARY_BASE = "https://dnd5e.lamagra.link";
export type RemoteMonsterRef = { name: string; source: string; file: string };
const filename = z.string().regex(/^bestiary-[a-z0-9_-]+\.json$/i);
async function download(path: string, signal?: AbortSignal): Promise<string> {
  const response = await fetch(`${BESTIARY_BASE}${path}`, {
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(15000)])
      : AbortSignal.timeout(15000),
    credentials: "omit",
    referrerPolicy: "no-referrer",
    redirect: "error",
  });
  if (!response.ok)
    throw new Error("The remote catalogue could not be loaded.");
  if (!response.body)
    throw new Error("The remote catalogue returned an empty response.");
  const reader = response.body.getReader(),
    decoder = new TextDecoder();
  let bytes = 0,
    text = "";
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > 32 * 1024 * 1024) {
        await reader.cancel();
        throw new Error("Remote catalogue response is too large.");
      }
      text += decoder.decode(chunk.value, { stream: true });
    }
    text += decoder.decode();
  } finally {
    reader.releaseLock();
  }

  return text;
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
      m: z.object({ s: z.record(z.number().int()) }),
      x: z.array(
        z.object({
          c: z.number(),
          n: z.string().optional(),
          s: z.union([z.number(), z.string()]).optional(),
        }),
      ),
    })
    .parse(JSON.parse(searchText));
  const index = z.record(filename).parse(JSON.parse(indexText));
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
