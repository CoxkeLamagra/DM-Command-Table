import assert from "node:assert/strict";
import test from "node:test";
import { matchesSearch } from "../features/shared/search.ts";

test("record search is case-insensitive and matches every typed term", () => {
  assert.equal(matchesSearch("green dragon", ["Ancient Green Dragon", "CR 22"]), true);
  assert.equal(matchesSearch("dragon red", ["Ancient Green Dragon", "CR 22"]), false);
  assert.equal(matchesSearch("  ", ["Anything"]), true);
});
