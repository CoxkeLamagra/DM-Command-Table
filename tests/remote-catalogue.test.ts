import test from "node:test";
import assert from "node:assert/strict";
import {
  loadRemoteCatalogue,
  searchRemoteCatalogue,
  BESTIARY_BASE,
} from "../features/bestiary/remote-catalogue.ts";

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
