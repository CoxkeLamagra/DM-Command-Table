import assert from "node:assert/strict";
import test from "node:test";
import { applyMonsterImports } from "../features/bestiary/import-service.ts";
import type { Monster } from "../features/campaign/types.ts";

const existing: Monster = {
  id: "existing",
  name: "Goblin",
  source: "MM",
  type: "Small humanoid",
  cr: "1/4",
  ac: 15,
  hp: 7,
  speed: "30 ft.",
  stats: "old",
  abilities: "old",
  spells: "No spells",
  slots: [0, 0, 0, 0, 0],
};

const remote = {
  name: "Goblin",
  source: "MM",
  size: ["S"],
  type: "humanoid",
  ac: [16],
  hp: { average: 8 },
  speed: { walk: 30 },
  cr: "1/4",
};

test("duplicate imports preserve ids when replaced", async () => {
  const result = await applyMonsterImports(
    [existing],
    [remote],
    () => "incoming",
    async () => true,
  );
  assert.equal(result.monsters[0].id, "existing");
  assert.equal(result.monsters[0].ac, 16);
  assert.deepEqual(
    { added: result.added, replaced: result.replaced, discarded: result.discarded },
    { added: 0, replaced: 1, discarded: 0 },
  );
});

test("duplicate imports remain unchanged when discarded", async () => {
  const result = await applyMonsterImports(
    [existing],
    [remote],
    () => "incoming",
    async () => false,
  );
  assert.deepEqual(result.monsters, [existing]);
  assert.equal(result.discarded, 1);
});
