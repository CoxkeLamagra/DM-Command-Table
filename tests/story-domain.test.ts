import assert from "node:assert/strict";
import test from "node:test";
import { removeSessionFromStory, toggleStorySession } from "../features/story/domain.ts";

const beat = {
  id: "beat",
  title: "Clue",
  chapter: "One",
  details: "",
  status: "active" as const,
  sessionIds: ["one", "two"],
};

test("story links can be added and removed without duplicates", () => {
  assert.deepEqual(toggleStorySession(beat, "one").sessionIds, ["two"]);
  assert.deepEqual(toggleStorySession(beat, "three").sessionIds, ["one", "two", "three"]);
});

test("deleting a session removes its story references", () => {
  assert.deepEqual(removeSessionFromStory([beat], "one")[0].sessionIds, ["two"]);
});
