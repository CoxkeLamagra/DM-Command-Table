import assert from "node:assert/strict";
import test from "node:test";
import { reconcileSaved } from "../features/encounters/drafts.ts";
test("save responses preserve edits made while a save is in flight", () => {
  const submitted = {
    id: "encounter",
    revision: 1,
    name: "Guard",
    notes: "old",
  };
  const saved = { ...submitted, revision: 2, notes: "sanitized" };
  assert.equal(reconcileSaved(submitted, submitted, saved), saved);
  const newer = { ...submitted, name: "Captain", notes: "new draft" };
  assert.deepEqual(reconcileSaved(newer, submitted, saved), {
    ...newer,
    revision: 2,
  });
});
