import {
  BESTIARY_BASE,
  type FiveEToolsMonster,
  type RemoteMonsterRef,
} from "./fiveetools.ts";

type Fetcher = (url: string) => Promise<{
  ok: boolean;
  json: () => Promise<unknown>;
}>;

export async function loadRemoteCatalogue(
  fetcher: Fetcher = fetch,
): Promise<RemoteMonsterRef[]> {
  const [searchResponse, indexResponse] = await Promise.all([
    fetcher(`${BESTIARY_BASE}/search/index.json`),
    fetcher(`${BESTIARY_BASE}/data/bestiary/index.json`),
  ]);
  if (!searchResponse.ok || !indexResponse.ok) throw new Error("catalogue");
  const search = (await searchResponse.json()) as {
    m?: { s?: Record<string, number> };
    x?: Array<{ c?: number; n?: string; s?: number }>;
  };
  const fileIndex = (await indexResponse.json()) as Record<string, string>;
  const sourceById = new Map(
    Object.entries(search.m?.s ?? {}).map(([source, id]) => [id, source]),
  );
  return (search.x ?? [])
    .filter((item) => item.c === 1 && item.n && sourceById.has(item.s ?? -1))
    .map((item) => {
      const source = sourceById.get(item.s ?? -1)!;
      return { name: item.n!, source, file: fileIndex[source] };
    })
    .filter((item) => Boolean(item.file));
}

export async function searchRemoteCatalogue(
  term: string,
  catalog: RemoteMonsterRef[],
  cache: Map<string, FiveEToolsMonster[]>,
  fetcher: Fetcher = fetch,
): Promise<FiveEToolsMonster[]> {
  const matches = catalog
    .filter((item) => item.name.toLowerCase().includes(term.toLowerCase()))
    .slice(0, 50);
  const files = [...new Set(matches.map((item) => item.file))];
  await Promise.all(
    files.map(async (file) => {
      if (cache.has(file)) return;
      const response = await fetcher(`${BESTIARY_BASE}/data/bestiary/${file}`);
      if (!response.ok) throw new Error("monster-data");
      const payload = (await response.json()) as {
        monster?: FiveEToolsMonster[];
      };
      cache.set(file, payload.monster ?? []);
    }),
  );
  return matches
    .map((reference) =>
      cache
        .get(reference.file)
        ?.find(
          (monster) =>
            monster.name === reference.name &&
            monster.source === reference.source,
        ),
    )
    .filter((monster): monster is FiveEToolsMonster => Boolean(monster));
}
