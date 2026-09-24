import assert from "node:assert/strict";
import test from "node:test";
import { normaliseCampaign } from "../features/campaign/normalise.ts";
import type { CampaignState } from "../features/campaign/types.ts";

test("normaliseCampaign adds backward-compatible defaults without changing ids", () => {
  const legacy = {
    campaignName: "Legacy",
    round: 2,
    turn: 0,
    combatants: [
      {
        id: "combatant-1",
        name: "Hero",
        kind: "hero",
        initiative: 12,
        hp: 10,
        maxHp: 10,
        ac: 14,
        condition: "Blessed",
      },
    ],
    players: [
      {
        id: "player-1",
        name: "Hero",
        hp: null,
        ac: null,
      },
    ],
    sessions: [
      {
        id: "session-1",
        title: "First session",
        date: "2026-01-01",
        body: "",
        done: false,
      },
    ],
  } as unknown as CampaignState;

  const result = normaliseCampaign(legacy);

  assert.equal(result.campaignNotes, "");
  assert.equal(result.encounterName, "The Ashen Crossing");
  assert.equal(result.combatants[0].id, "combatant-1");
  assert.equal(result.combatants[0].kind, "player");
  assert.deepEqual(result.combatants[0].conditions, ["Blessed"]);
  assert.equal(result.players[0].level, 1);
  assert.deepEqual(result.sessions[0].encounters, []);
  assert.deepEqual(result.monsters, []);
  assert.deepEqual(result.story, []);
});

test("normaliseCampaign preserves prepared encounter monster numbers", () => {
  const campaign = {
    campaignName: "Current",
    campaignNotes: "",
    encounterName: "Encounter",
    round: 1,
    turn: 0,
    combatants: [],
    players: [],
    monsters: [],
    story: [],
    sessions: [
      {
        id: "session-1",
        title: "Session",
        date: "2026-01-01",
        body: "",
        done: false,
        encounters: [
          {
            id: "encounter-1",
            name: "Ambush",
            monsters: [{ id: "entry-1", monsterId: "monster-1", number: 2 }],
          },
        ],
      },
    ],
  } satisfies CampaignState;

  assert.equal(
    normaliseCampaign(campaign).sessions[0].encounters[0].monsters[0].number,
    2,
  );
});
