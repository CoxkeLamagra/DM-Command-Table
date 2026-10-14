import test from "node:test";
import assert from "node:assert/strict";
import { parseCatalogue } from "../features/bestiary/local-catalogue.ts";
import {
  convertCatalogueMonster,
  cleanCatalogueText,
} from "../features/bestiary/fiveetools.ts";
import {
  abilityScores,
  abilitySections,
} from "../domain/monster-stat-block.ts";

test("import preserves stat block metadata and full spell lists through local catalogue validation", () => {
  const [monster] = parseCatalogue(
    JSON.stringify({
      monster: [
        {
          name: "Test mage",
          source: "TEST",
          type: "humanoid",
          alignment: ["L", "G"],
          ac: [{ ac: 15, from: ["natural armor"] }],
          hp: { average: 32, formula: "5d8 + 10" },
          save: { dex: "+4" },
          skill: { arcana: "+5" },
          resist: [{ resist: ["fire"], note: "while shielded" }],
          immune: ["poison"],
          conditionImmune: ["poisoned"],
          senses: ["darkvision 60 ft."],
          passive: 14,
          languages: ["Common"],
          spellcasting: [
            {
              name: "Spellcasting",
              headerEntries: ["Intelligence is the spellcasting ability."],
              will: ["{@spell light}"],
              daily: { "1e": ["{@spell shield}"] },
              spells: { "1": { slots: 4, spells: ["{@spell magic missile}"] } },
            },
          ],
        },
      ],
    }),
  );
  const result = convertCatalogueMonster(monster, () => "id");
  for (const value of [
    "lawful good",
    "natural armor",
    "5d8 + 10",
    "dex: +4",
    "arcana: +5",
    "fire; while shielded",
    "poisoned",
    "darkvision 60 ft.",
    "Passive Perception: 14",
    "Languages: Common",
  ])
    assert.ok(result.abilities.includes(value), value);
  for (const value of [
    "Intelligence",
    "At will: light",
    "1 each/day: shield",
    "Level 1 (4 slots): magic missile",
  ])
    assert.ok(result.spells.includes(value), value);
  assert.deepEqual(result.slots, [4, 0, 0, 0, 0]);
});
test("visual ability table accepts imported and edited scores, leaving absent scores unknown", () => {
  assert.deepEqual(
    abilityScores("<p>STR 18 DEX 12 CON 16 INT 6 WIS 11 CHA 8</p>").map(
      ({ value }) => value,
    ),
    [18, 12, 16, 6, 11, 8],
  );
  assert.equal(
    abilityScores("custom description").every(
      ({ value }) => value === undefined,
    ),
    true,
  );
});

test("plain imported stat-block sections retain their categories while edited rich text remains intact", () => {
  assert.deepEqual(
    abilitySections(
      "Creature details\nLanguages: Common\n\nTraits\nMagic Resistance — Advantage\n\nActions\nBite — 5 damage",
    ).map(({ title }) => title),
    ["Creature details", "Traits", "Actions"],
  );
  assert.deepEqual(
    abilitySections("<p><strong>Bite</strong> — Custom attack</p>"),
    [
      {
        title: "Traits and Actions",
        value: "<p><strong>Bite</strong> — Custom attack</p>",
      },
    ],
  );
});

test("stat-block rules text retains hit/DC/recharge labels from catalogue tags", () => {
  assert.equal(
    cleanCatalogueText(
      "{@atk mw} {@hit 4} to hit. {@h}{@damage 1d6 + 2}. {@dc 13} save. Breath {@recharge 5}",
    ),
    "Melee Weapon Attack: +4 to hit. Hit: 1d6 + 2. DC 13 save. Breath (Recharge 5–6)",
  );
});

test("monster tokens survive rich text sanitization and snapshot capture", async () => {
  const { attachMonsterToken, extractMonsterToken } =
    await import("../domain/monster-stat-block.ts");
  const { sanitizeRichText } =
    await import("../server/security/sanitize-rich-text.ts");
  const { snapshotMonster } = await import("../domain/combat-runtime.ts");
  const url = "/api/screenshots/abcdef-1234";
  const abilities = sanitizeRichText(
    attachMonsterToken("Actions\nClaw attack", url),
  );
  const snapshot = snapshotMonster({
    name: "Cat",
    hitPoints: 2,
    armorClass: 12,
    abilities,
  });
  assert.deepEqual(extractMonsterToken(snapshot.abilities), {
    tokenUrl: url,
    abilities: "Actions\nClaw attack",
  });
  assert.throws(() => attachMonsterToken("", "https://example.com/token.png"));
});

test("catalogue tokens support explicit references and reject external image hosts", async () => {
  const { catalogueTokenUrl } =
    await import("../features/bestiary/monster-token.ts");
  assert.equal(
    catalogueTokenUrl({ name: "Goblin", source: "MM", hasToken: true }),
    "https://dnd5e.lamagra.link/img/bestiary/tokens/MM/Goblin.webp",
  );
  assert.equal(
    catalogueTokenUrl({
      name: "Alternate",
      source: "X",
      token: { name: 'Café "Cat"', source: "MM" },
    }),
    "https://dnd5e.lamagra.link/img/bestiary/tokens/MM/Cafe%20Cat.webp",
  );
  assert.equal(
    catalogueTokenUrl({
      name: "X",
      source: "X",
      tokenHref: { type: "internal", path: "bestiary/tokens/MM/Goblin.webp" },
    }),
    "https://dnd5e.lamagra.link/img/bestiary/tokens/MM/Goblin.webp",
  );
  assert.equal(
    catalogueTokenUrl({
      name: "X",
      source: "X",
      tokenUrl: "https://elsewhere.example/icon.png",
    }),
    undefined,
  );
  assert.equal(catalogueTokenUrl({ name: "X", source: "X" }), undefined);
});
