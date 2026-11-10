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

test("cached roster search reuses text across terms/queries and refreshes replaced records", async () => {
  const { createRecordSearch } = await import("../features/shared/search.ts");
  const extracted: string[] = [];
  const search = createRecordSearch<{ name: string; notes: string }>(
    (record) => {
      extracted.push(record.name);
      return `${record.name} ${record.notes}`;
    },
  );
  const first = { name: "Green dragon", notes: "Ancient guardian" };
  const second = { name: "Town guard", notes: "Human fighter" };
  const records = [first, second];
  assert.deepEqual(search(records, "  "), records);
  assert.equal(extracted.length, 0);
  assert.deepEqual(search(records, "GREEN ancient"), [first]);
  assert.deepEqual(search(records, "guardian dragon"), [first]);
  assert.deepEqual(
    search(records, "human", (item) => item === second),
    [second],
  );
  assert.equal(extracted.length, 2);
  const edited = { ...first, notes: "Young scout" };
  assert.deepEqual(search([edited, second], "ancient"), []);
  assert.deepEqual(search([edited, second], "young dragon"), [edited]);
  assert.equal(extracted.length, 3);
  assert.deepEqual(search([edited, second], "dragon red"), []);
  assert.deepEqual(search([edited, second], ".*"), []);
});
