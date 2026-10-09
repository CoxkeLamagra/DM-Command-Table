import assert from "node:assert/strict";
import test from "node:test";
import {
  draftKey,
  readDraft,
  writeDraft,
  clearUserDrafts,
  DRAFT_LIFETIME,
} from "../features/shared/draft-storage.ts";
import { applyCombatAction, takesTurn } from "../domain/combat.ts";
import { previewPreparation } from "../domain/encounter-preview.ts";
import type {
  CombatEncounter,
  Combatant,
  PreparedEncounter,
} from "../domain/encounters.ts";
function storage() {
  const entries = new Map<string, string>();
  return {
    get length() {
      return entries.size;
    },
    key(index: number) {
      return [...entries.keys()][index] ?? null;
    },
    getItem(key: string) {
      return entries.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      entries.set(key, value);
    },
    removeItem(key: string) {
      entries.delete(key);
    },
  };
}
test("draft recovery is account/campaign scoped, retains revisions and expires", () => {
  const store = storage();
  const first = draftKey("alice", "campaign-1", "sessions");
  const second = draftKey("alice", "campaign-2", "sessions");
  const other = draftKey("bob", "campaign-1", "sessions");
  writeDraft(store, first, { notes: "unsaved", revision: 4 }, 1000);
  writeDraft(store, second, { notes: "other campaign" }, 1000);
  writeDraft(store, other, { notes: "other user" }, 1000);
  assert.deepEqual(readDraft(store, first, 2000)?.value, {
    notes: "unsaved",
    revision: 4,
  });
  clearUserDrafts(store, "alice");
  assert.equal(readDraft(store, first, 2000), null);
  assert.equal(readDraft(store, second, 2000), null);
  assert.deepEqual(readDraft(store, other, 2000)?.value, {
    notes: "other user",
  });
  assert.equal(readDraft(store, other, 1001 + DRAFT_LIFETIME), null);
  store.setItem(first, "null");
  assert.equal(readDraft(store, first), null);
  store.setItem(first, "broken json");
  assert.equal(readDraft(store, first), null);
});
function entry(
  id: string,
  kind: Combatant["kind"],
  hp: number,
  initiative: number,
): Combatant {
  return {
    id,
    kind,
    name: id,
    hitPoints: hp,
    maximumHitPoints: 10,
    initiative,
    armorClass: 10,
    playerId: null,
    monsterId: null,
    displayNumber: null,
    notes: "",
    sortOrder: 0,
    conditions: [{ id: "condition", name: "Blessed", remainingTurns: 2 }],
    revision: 1,
  };
}
function combat(entries: Combatant[]): CombatEncounter {
  return {
    id: "combat",
    campaignId: "campaign",
    name: "Fight",
    combatants: entries,
    turn: 0,
    round: 1,
    revision: 1,
    createdAt: "",
    updatedAt: "",
  };
}
test("zero HP policy retains Player turns, skips other downed creatures and applies turn effects", () => {
  const current = combat([
    entry("monster", "monster", 10, 30),
    entry("player", "player", 0, 20),
    entry("npc", "npc", 0, 10),
  ]);
  assert.equal(
    applyCombatAction(current, "next-turn").combatants[
      applyCombatAction(current, "next-turn").turn
    ].id,
    "monster",
  );
  const next = applyCombatAction(current, "next-turn", "include-players");
  assert.equal(next.combatants[next.turn].id, "player");
  assert.equal(next.combatants[next.turn].conditions[0].remainingTurns, 1);
  const wrapped = applyCombatAction(next, "next-turn", "include-players");
  assert.equal(wrapped.turn, 0);
  assert.equal(wrapped.round, 2);
  assert.equal(
    applyCombatAction(next, "next-turn", "include-all").combatants[2].id,
    "npc",
  );
  assert.equal(takesTurn(current.combatants[2], "include-players"), false);
});
test("zero HP policy handles all-downed groups, empty combat and round reset", () => {
  const current = combat([
    entry("npc", "npc", 0, 20),
    entry("player", "player", 0, 10),
  ]);
  assert.equal(applyCombatAction(current, "next-turn").round, 1);
  assert.equal(
    applyCombatAction(current, "next-turn", "include-players").turn,
    1,
  );
  assert.equal(
    applyCombatAction({ ...current, turn: 1 }, "next-turn", "include-players")
      .round,
    2,
  );
  assert.equal(
    applyCombatAction(current, "reset-rounds", "include-players").turn,
    1,
  );
  assert.deepEqual(
    applyCombatAction(combat([]), "next-turn", "include-all").combatants,
    [],
  );
});
test("encounter preview matches load semantics and warns about retained names without modifying state", () => {
  const current = combat([
    entry("Guide", "npc", 5, 10),
    entry("Goblin", "monster", 4, 5),
  ]);
  const prepared: PreparedEncounter = {
    id: "prepared",
    sessionId: "session",
    name: "Next",
    notes: "",
    sortOrder: 0,
    revision: 1,
    createdAt: "",
    updatedAt: "",
    monsters: [
      {
        id: "row",
        monsterId: "goblin",
        quantity: 3,
        displayNumber: null,
        sortOrder: 0,
      },
    ],
    combatants: [entry("guide", "npc", 10, 10)],
  };
  const preview = previewPreparation(current, prepared);
  assert.equal(preview.retained.length, 1);
  assert.equal(preview.replaced.length, 1);
  assert.equal(preview.total, 5);
  assert.deepEqual(preview.duplicateNames, ["guide"]);
  assert.equal(current.combatants[0].hitPoints, 5);
  assert.equal(prepared.monsters[0].quantity, 3);
});
