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

test("catalogue accepts null ability sections and choice creature types without blocking other monsters", () => {
  const records = parseCatalogue(
    JSON.stringify({
      monster: [
        {
          name: "Empyrean",
          source: "XMM",
          type: { type: { choose: ["celestial", "fiend"] }, tags: ["titan"] },
          hp: { average: 346 },
          trait: null,
          action: null,
          bonus: null,
          reaction: null,
          legendary: null,
          mythic: null,
          spellcasting: null,
        },
        {
          name: "Goblin",
          source: "XMM",
          hp: { average: 10 },
          action: [{ name: "Scimitar", entries: ["5 damage"] }],
        },
      ],
    }),
  );
  const converted = convertCatalogueMonster(records[0], () => "id");
  assert.match(converted.type, /celestial or fiend/);
  assert.equal(converted.hp, 346);
  assert.equal(converted.abilities, "No special actions or traits.");
  assert.equal(converted.spells, "No spells");
  assert.match(
    convertCatalogueMonster(records[1], () => "id").abilities,
    /Scimitar/,
  );
  assert.throws(() =>
    parseCatalogue(
      JSON.stringify({
        monster: [
          { name: "Invalid", source: "XMM", type: { type: { choose: [42] } } },
        ],
      }),
    ),
  );
});
