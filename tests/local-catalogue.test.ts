import assert from "node:assert/strict";
import test from "node:test";
import {
  parseCatalogue,
  searchCatalogue,
} from "../features/bestiary/local-catalogue.ts";
import { convertCatalogueMonster } from "../features/bestiary/fiveetools.ts";

test("local catalogues validate conversion fields, deduplicate by source and search without network access", () => {
  const catalogue = parseCatalogue(
    JSON.stringify({
      monster: [
        {
          name: "Goblin",
          source: "MM",
          hp: { average: 7 },
          action: [{ name: "Bite", entries: ["1 damage"] }],
        },
        { name: " Goblin ", source: "mm", hp: { average: 8 } },
        { name: "Goblin", source: "Other" },
      ],
    }),
  );
  assert.equal(catalogue.length, 2);
  assert.equal(searchCatalogue(" mm ", catalogue).length, 1);
  assert.equal(searchCatalogue("g", catalogue).length, 0);
  assert.equal(convertCatalogueMonster(catalogue[0], () => "id").hp, 8);
  for (const entry of [
    null,
    { name: "", source: "MM" },
    { name: "X", source: "MM", ac: "bad" },
    { name: "X", source: "MM", action: {} },
    { name: "X", source: "MM", hp: { average: "bad" } },
  ])
    assert.throws(() => parseCatalogue(JSON.stringify({ monster: [entry] })));
  assert.throws(
    () => parseCatalogue("x".repeat(10 * 1024 * 1024 + 1)),
    /10 MB/,
  );
});
