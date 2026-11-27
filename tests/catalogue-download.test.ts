import test from "node:test";
import assert from "node:assert/strict";
import {
  catalogueUrl,
  readCatalogueBody,
} from "../features/bestiary/catalogue-download.ts";
import { downloadMonsterToken } from "../features/bestiary/monster-token.ts";

test("catalogue URLs reject other origins, credential URLs and unrelated paths", () => {
  assert.equal(
    catalogueUrl("/data/bestiary/bestiary-mm.json"),
    "https://dnd5e.lamagra.link/data/bestiary/bestiary-mm.json",
  );
  for (const url of [
    "https://evil.example/img/x.webp",
    "https://user:pass@dnd5e.lamagra.link/img/x.webp",
    "/api/admin",
    "/img/../../api/admin",
  ])
    assert.throws(() => catalogueUrl(url), /Invalid catalogue URL/);
});

test("bounded catalogue reads enforce streamed bytes and cancel rejected bodies", async () => {
  let cancelled = 0;
  const response = () =>
    new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array([1, 2, 3, 4]));
        },
        cancel() {
          cancelled++;
        },
      }),
      { headers: { "content-length": "1", "content-type": "image/webp" } },
    );
  await assert.rejects(readCatalogueBody(response(), 3), /too large/);
  assert.equal(cancelled, 1);
  await assert.rejects(
    readCatalogueBody(response(), 10, ["image/png"]),
    /Unsupported/,
  );
  assert.equal(cancelled, 2);
  const valid = await readCatalogueBody(
    new Response("é", { headers: { "content-type": "application/json" } }),
    2,
  );
  assert.equal(new TextDecoder().decode(valid.bytes), "é");
});

test("unavailable token downloads can retry and successful requests are coalesced", async () => {
  const original = globalThis.fetch;
  let calls = 0;
  const url = "https://dnd5e.lamagra.link/img/test-retry.webp";
  globalThis.fetch = async () => {
    calls++;
    return calls === 1
      ? new Response("unavailable", { status: 503 })
      : new Response(new Uint8Array([1, 2, 3]), {
          headers: { "content-type": "image/webp" },
        });
  };
  try {
    assert.equal(await downloadMonsterToken(url), null);
    const [first, second] = await Promise.all([
      downloadMonsterToken(url),
      downloadMonsterToken(url),
    ]);
    assert.ok(first);
    assert.equal(first, second);
    assert.equal(first.size, 3);
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = original;
  }
});
