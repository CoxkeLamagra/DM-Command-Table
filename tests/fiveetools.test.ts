import assert from "node:assert/strict";
import test from "node:test";
import {
  cleanRemoteText,
  convertRemoteMonster,
  getRemoteSummary,
  monsterIdentity,
} from "../features/bestiary/fiveetools.ts";

test("5eTools text markup is converted to readable local text", () => {
  assert.equal(
    cleanRemoteText("{@atk mw} {@damage 1d8+3|1d8 + 3}"),
    "Melee Weapon Attack: 1d8+3",
  );
});

test("remote monster conversion preserves the fields used by the Bestiary", () => {
  const monster = convertRemoteMonster(
    {
      name: "Test Drake",
      source: "TST",
      size: ["M"],
      type: "dragon",
      ac: [{ ac: 16 }],
      hp: { average: 42 },
      speed: { walk: 30, fly: 60 },
      str: 18,
      dex: 12,
      con: 16,
      int: 6,
      wis: 11,
      cha: 8,
      cr: "3",
      action: [{ name: "Bite", entries: ["{@atk mw} +6 to hit"] }],
    },
    () => "monster-id",
  );

  assert.equal(monster.id, "monster-id");
  assert.equal(monster.type, "Medium dragon");
  assert.equal(monster.ac, 16);
  assert.equal(monster.hp, 42);
  assert.equal(monster.speed, "30 ft., fly 60 ft.");
  assert.match(monster.abilities, /Melee Weapon Attack:/);
  assert.deepEqual(monster.slots, [0, 0, 0, 0, 0]);
});

test("duplicate identity is case-insensitive and source-specific", () => {
  assert.equal(
    monsterIdentity({ name: "Goblin", source: "MM" }),
    monsterIdentity({ name: " goblin ", source: "mm" }),
  );
  assert.notEqual(
    monsterIdentity({ name: "Goblin", source: "MM" }),
    monsterIdentity({ name: "Goblin", source: "VGM" }),
  );
  assert.deepEqual(getRemoteSummary({ name: "Unknown", source: "TST" }), {
    type: "creature",
    ac: 10,
    hp: 10,
    cr: "—",
  });
});
