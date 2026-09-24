import assert from "node:assert/strict";
import test from "node:test";
import {
  addPreparedMonster,
  createPreparedEncounter,
  createSessionNote,
} from "../features/sessions/domain.ts";

test("session and encounter defaults remain stable", () => {
  assert.deepEqual(createSessionNote(() => "session", "2026-09-24"), {
    id: "session",
    title: "New session",
    date: "2026-09-24",
    body: "",
    done: false,
    encounters: [],
  });
  assert.deepEqual(createPreparedEncounter(1, () => "encounter"), {
    id: "encounter",
    name: "Encounter 2",
    monsters: [],
  });
});

test("prepared monsters keep sequential per-type numbering", () => {
  const encounter = {
    id: "e",
    name: "Ambush",
    monsters: [
      { id: "one", monsterId: "goblin", number: 1 },
      { id: "two", monsterId: "wolf", number: 4 },
    ],
  };
  assert.deepEqual(addPreparedMonster(encounter, "goblin", () => "three"), {
    id: "three",
    monsterId: "goblin",
    number: 2,
  });
});
