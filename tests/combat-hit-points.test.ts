import assert from "node:assert/strict";
import test from "node:test";
import { adjustHitPoints } from "../features/combat/hit-points.ts";

test("damage and healing respect zero/max HP and reject invalid adjustments", () => {
  assert.equal(adjustHitPoints(35, 40, 12, "damage"), 23);
  assert.equal(adjustHitPoints(5, 40, 12, "damage"), 0);
  assert.equal(adjustHitPoints(35, 40, 12, "heal"), 40);
  assert.equal(adjustHitPoints(0, 40, 12, "heal"), 12);
  for (const amount of [0, -1, NaN, Infinity])
    assert.throws(() => adjustHitPoints(35, 40, amount, "damage"));
});
