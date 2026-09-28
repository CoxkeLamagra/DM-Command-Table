import assert from "node:assert/strict";
import test from "node:test";
import { createCampaignCopy } from "../features/campaign/copy.ts";
import type { CampaignState } from "../features/campaign/types.ts";

const campaign: CampaignState = {
  campaignName: "The Ember Crown",
  campaignNotes: "<p>Secret history</p>",
  encounterName: "Gatehouse",
  round: 3,
  turn: 2,
  combatants: [{
    id: "combatant-1", name: "Goblin", kind: "monster", initiative: 14,
    hp: 5, maxHp: 7, ac: 15, conditions: [], monsterId: "monster-1",
  }],
  players: [{
    id: "player-1", name: "Ada", race: "Human", className: "Wizard",
    level: 4, hp: 22, ac: 13, notes: "<p>Scholar</p>",
  }],
  monsters: [{
    id: "monster-1", name: "Goblin", type: "Humanoid", cr: "1/4",
    ac: 15, hp: 7, speed: "30 ft.", stats: "", abilities: "", spells: "",
    notes: "<p>Ambusher</p>", slots: [],
  }],
  sessions: [{
    id: "session-1", title: "At the gate", date: "2026-09-27",
    body: "<p>The party arrives.</p>", done: true, status: "happened",
    encounters: [{
      id: "encounter-1", name: "Gate guards",
      monsters: [{ id: "slot-1", monsterId: "monster-1", number: 2 }],
    }],
  }],
  story: [{
    id: "story-1", title: "Find the crown", chapter: "Chapter 1",
    details: "<p>A dangerous lead.</p>", status: "happened",
    sessionIds: ["session-1"],
  }],
};

test("copying as a new campaign preserves all campaign state", () => {
  const result = createCampaignCopy(campaign, "campaign");

  assert.equal(result.campaignName, "The Ember Crown — Copy");
  assert.deepEqual({ ...result, campaignName: campaign.campaignName }, campaign);
  assert.notEqual(result, campaign);
  assert.notEqual(result.sessions, campaign.sessions);
});

test("copying as a template excludes players and resets progress", () => {
  const result = createCampaignCopy(campaign, "template");

  assert.equal(result.campaignName, "The Ember Crown — Template");
  assert.deepEqual(result.players, []);
  assert.deepEqual(result.combatants, []);
  assert.equal(result.encounterName, "New encounter");
  assert.equal(result.round, 1);
  assert.equal(result.turn, 0);
  assert.equal(result.sessions[0].done, false);
  assert.equal(result.sessions[0].status, "planned");
  assert.equal(result.story[0].status, "planned");
  assert.equal(result.sessions[0].body, campaign.sessions[0].body);
  assert.deepEqual(result.sessions[0].encounters, campaign.sessions[0].encounters);
  assert.equal(result.story[0].details, campaign.story[0].details);
  assert.deepEqual(result.story[0].sessionIds, ["session-1"]);
  assert.deepEqual(result.monsters, campaign.monsters);
  assert.equal(result.campaignNotes, campaign.campaignNotes);
});
