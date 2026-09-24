import assert from "node:assert/strict";
import test from "node:test";
import {
  advanceCombatTurn,
  createMonsterCombatants,
  createPreparedCombatants,
  createPlayerCombatants,
  turnAfterRemovingMonsters,
} from "../features/combat/domain.ts";
import type { Combatant, Monster } from "../features/campaign/types.ts";

const combatant = (id: string, kind: Combatant["kind"], hp = 10): Combatant => ({
  id, name: id, kind, initiative: 10, hp, maxHp: 10, ac: 10, conditions: [],
});

test("combat advancement skips downed combatants and advances the round", () => {
  const ordered = [combatant("a", "player"), combatant("b", "monster", 0)];
  assert.deepEqual(advanceCombatTurn(ordered, 0, 2), { turn: 0, round: 3 });
  assert.equal(advanceCombatTurn([combatant("down", "monster", 0)], 0, 1), null);
});

test("campaign players retain fallback HP and AC values", () => {
  const result = createPlayerCombatants(
    [{ id: "p", name: "Hero", race: "", className: "", level: 1, hp: null, ac: null, notes: "" }],
    ["p"],
    () => "new",
  );
  assert.equal(result[0].hp, 10);
  assert.equal(result[0].ac, 10);
  assert.equal(result[0].campaignPlayerId, "p");
});

test("bestiary and prepared monsters preserve numbering and links", () => {
  const monster: Monster = {
    id: "m", name: "Goblin", type: "humanoid", cr: "1/4", ac: 15, hp: 7,
    speed: "30 ft.", stats: "", abilities: "", spells: "", slots: [],
  };
  const existing = [{ ...combatant("old", "monster"), monsterId: "m", number: 2 }];
  assert.equal(createMonsterCombatants([monster], ["m"], existing, () => "new")[0].number, 3);
  assert.equal(
    createPreparedCombatants(
      { id: "e", name: "Ambush", monsters: [{ id: "r", monsterId: "m", number: 4 }] },
      [monster],
      () => "prepared",
    )[0].number,
    4,
  );
});

test("removing active monsters selects the first standing survivor", () => {
  const ordered = [combatant("monster", "monster"), combatant("down", "player", 0), combatant("hero", "player")];
  assert.equal(turnAfterRemovingMonsters(ordered, 0), 1);
});
