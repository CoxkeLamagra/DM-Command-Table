import assert from "node:assert/strict";
import test from "node:test";
import { matchesSearch } from "../features/shared/search.ts";

test("record search is case-insensitive and matches every typed term", () => {
  assert.equal(
    matchesSearch("green dragon", ["Ancient Green Dragon", "CR 22"]),
    true,
  );
  assert.equal(
    matchesSearch("dragon red", ["Ancient Green Dragon", "CR 22"]),
    false,
  );
  assert.equal(matchesSearch("  ", ["Anything"]), true);
});

test("search highlights treat punctuation as literal text and retain the original content", async () => {
  const { highlightParts } =
    await import("../features/shared/search-highlight.ts");
  const parts = highlightParts("Dragon + a.b <script> &", "dra a.b +");
  assert.equal(
    parts.map(({ text }) => text).join(""),
    "Dragon + a.b <script> &",
  );
  assert.deepEqual(
    parts.filter(({ match }) => match).map(({ text }) => text),
    ["Dra", "+", "a.b"],
  );
  assert.deepEqual(highlightParts("Anything", ""), [
    { text: "Anything", match: false },
  ]);
});
