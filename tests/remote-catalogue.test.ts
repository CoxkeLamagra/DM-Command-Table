import test from "node:test";
import assert from "node:assert/strict";
import {
  loadRemoteCatalogue,
  searchRemoteCatalogue,
  searchRemoteCatalogues,
  BESTIARY_BASE,
  FALLBACK_BESTIARY_BASE,
} from "../features/bestiary/remote-catalogue.ts";
import { catalogueTokenUrl } from "../features/bestiary/monster-token.ts";

test("remote catalogue joins source indexes, validates files, searches and reuses decoded data", async () => {
  const original = globalThis.fetch;
  const requests: string[] = [];
  const payloads: Record<string, unknown> = {
    "/search/index.json": {
      m: { s: { MM: 1 } },
      x: [
        { c: 1, n: "Remote goblin", s: 1 },
        { c: 2, n: "Spell", s: 1 },
        { c: 1, n: "Remote orc", s: "MM" },
      ],
    },
    "/data/bestiary/index.json": { MM: "bestiary-mm.json" },
    "/data/bestiary/bestiary-mm.json": {
      monster: [
        { name: "Remote goblin", source: "MM", hp: { average: 7 } },
        { name: "Remote orc", source: "MM" },
      ],
    },
  };
  globalThis.fetch = async (url, options) => {
    assert.equal(options?.credentials, "omit");
    assert.equal(options?.referrerPolicy, "no-referrer");
    assert.equal(options?.redirect, "error");
    const path = String(url).slice(BESTIARY_BASE.length);
    requests.push(path);
    return new Response(JSON.stringify(payloads[path]), { status: 200 });
  };
  try {
    const catalogue = await loadRemoteCatalogue();
    assert.equal(catalogue.length, 2);
    const cache = new Map();
    assert.equal(
      (await searchRemoteCatalogue(" goblin ", catalogue, cache))[0].hp
        ?.average,
      7,
    );
    assert.equal(
      (await searchRemoteCatalogue("MM", catalogue, cache)).length,
      2,
    );
    assert.equal(
      requests.filter((path) => path.endsWith("bestiary-mm.json")).length,
      1,
    );
    assert.deepEqual(await searchRemoteCatalogue("g", catalogue, cache), []);
    await assert.rejects(
      searchRemoteCatalogue(
        "Goblin",
        [{ ...catalogue[0], file: "../../evil.json" }],
        cache,
      ),
    );
    const controller = new AbortController();
    controller.abort();
    await assert.rejects(
      searchRemoteCatalogue("goblin", catalogue, cache, controller.signal),
    );
  } finally {
    globalThis.fetch = original;
  }
});

test("failed or malformed catalogue responses reject without becoming cached imports", async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response("Unavailable", { status: 503 });
    await assert.rejects(loadRemoteCatalogue(), /could not be loaded/);
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ monster: [null] }));
    const cache = new Map();
    await assert.rejects(
      searchRemoteCatalogue(
        "Goblin",
        [{ name: "Goblin", source: "MM", file: "bestiary-mm.json" }],
        cache,
      ),
    );
    assert.equal(cache.size, 0);
  } finally {
    globalThis.fetch = original;
  }
});

const FALLBACK = "https://5e.tools";
function catalogueSite(name: string) {
  return {
    "/search/index.json": {
      m: { s: { MM: 1 } },
      x: [{ c: 1, n: name, s: 1 }],
    },
    "/data/bestiary/index.json": { MM: "bestiary-mm.json" },
    "/data/bestiary/bestiary-mm.json": {
      monster: [{ name, source: "MM", hasToken: true }],
    },
  } as Record<string, unknown>;
}

test("5e.tools is searched when dnd5e.lamagra.link has no match, and tokens come from the matching site", async () => {
  const original = globalThis.fetch;
  const requests: string[] = [];
  const sites: Record<string, Record<string, unknown>> = {
    [BESTIARY_BASE]: catalogueSite("Primary goblin"),
    [FALLBACK]: catalogueSite("Fallback kobold"),
  };
  globalThis.fetch = async (url) => {
    const parsed = new URL(String(url));
    requests.push(parsed.href);
    return new Response(JSON.stringify(sites[parsed.origin][parsed.pathname]));
  };
  try {
    const primary = await loadRemoteCatalogue();
    let fallbackLoads = 0;
    const loadFallback = () => {
      fallbackLoads++;
      return loadRemoteCatalogue(undefined, FALLBACK_BESTIARY_BASE);
    };
    const cache = new Map();
    const found = await searchRemoteCatalogues(
      "goblin",
      primary,
      loadFallback,
      cache,
    );
    assert.deepEqual(
      found.map((item) => item.name),
      ["Primary goblin"],
    );
    assert.equal(fallbackLoads, 0);
    assert.equal(
      catalogueTokenUrl(found[0]),
      `${BESTIARY_BASE}/img/bestiary/tokens/MM/Primary%20goblin.webp`,
    );
    const fallback = await searchRemoteCatalogues(
      "kobold",
      primary,
      loadFallback,
      cache,
    );
    assert.deepEqual(
      fallback.map((item) => item.name),
      ["Fallback kobold"],
    );
    assert.equal(fallbackLoads, 1);
    assert.equal(
      catalogueTokenUrl(fallback[0]),
      `${FALLBACK}/img/bestiary/tokens/MM/Fallback%20kobold.webp`,
    );
    // Both sites use the same file name; their downloads are cached apart.
    assert.equal(
      requests.filter((url) => url.endsWith("bestiary-mm.json")).length,
      2,
    );
    assert.deepEqual(
      await searchRemoteCatalogues("dragon", primary, loadFallback, cache),
      [],
    );
  } finally {
    globalThis.fetch = original;
  }
});

test("5e.tools is searched when dnd5e.lamagra.link cannot be reached", async () => {
  const original = globalThis.fetch;
  const fallbackSite = catalogueSite("Remote goblin");
  let primaryUp = true;
  globalThis.fetch = async (url) => {
    const parsed = new URL(String(url));
    if (parsed.origin === BESTIARY_BASE) {
      if (!primaryUp) throw new TypeError("Failed to fetch");
      return new Response(
        JSON.stringify(catalogueSite("Remote goblin")[parsed.pathname]),
      );
    }
    return new Response(JSON.stringify(fallbackSite[parsed.pathname]));
  };
  try {
    const primary = await loadRemoteCatalogue();
    primaryUp = false;
    const loadFallback = () =>
      loadRemoteCatalogue(undefined, FALLBACK_BESTIARY_BASE);
    // Index loaded, but the monster file download fails mid-session.
    const found = await searchRemoteCatalogues(
      "goblin",
      primary,
      loadFallback,
      new Map(),
    );
    assert.equal(found.length, 1);
    assert.equal(catalogueTokenUrl(found[0])?.startsWith(FALLBACK), true);
    // The primary index never loaded.
    await assert.rejects(loadRemoteCatalogue(), /Failed to fetch/);
    assert.equal(
      (await searchRemoteCatalogues("goblin", [], loadFallback, new Map()))
        .length,
      1,
    );
    // Both sites down: the error is reported instead of an empty result.
    const down = () => Promise.reject(new Error("5e.tools down"));
    await assert.rejects(
      searchRemoteCatalogues("goblin", primary, down, new Map()),
      /Failed to fetch/,
    );
    await assert.rejects(
      searchRemoteCatalogues("goblin", [], down, new Map()),
      /5e.tools down/,
    );
    // Primary reachable with no match while 5e.tools is down: no results.
    primaryUp = true;
    assert.deepEqual(
      await searchRemoteCatalogues("dragon", primary, down, new Map()),
      [],
    );
  } finally {
    globalThis.fetch = original;
  }
});
