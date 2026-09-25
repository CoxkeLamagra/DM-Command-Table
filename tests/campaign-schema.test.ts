import assert from "node:assert/strict";
import test from "node:test";
import { createStarterCampaign } from "../lib/starter-campaign.ts";
import {
  CAMPAIGN_EXPORT_FORMAT,
  CAMPAIGN_EXPORT_VERSION,
  campaignStateSchema,
  parseCampaignExport,
} from "../features/campaign/schema.ts";
import type { CampaignState } from "../features/campaign/types.ts";

test("the canonical starter campaign passes strict validation", () => {
  const campaign = createStarterCampaign<CampaignState>();
  assert.deepEqual(campaignStateSchema.parse(campaign), campaign);
});

test("legacy campaign shapes are rejected instead of silently rewritten", () => {
  const legacy = {
    campaignName: "Legacy",
    round: 1,
    turn: 0,
    combatants: [{
      id: "hero",
      name: "Hero",
      kind: "hero",
      initiative: 10,
      hp: 10,
      maxHp: 10,
      ac: 10,
      condition: "Blessed",
    }],
    players: [],
    monsters: [],
    sessions: [],
    story: [],
  };
  assert.equal(campaignStateSchema.safeParse(legacy).success, false);
});

test("only current v4 campaign exports are accepted", () => {
  const payload = createStarterCampaign<CampaignState>();
  const current = {
    format: CAMPAIGN_EXPORT_FORMAT,
    version: CAMPAIGN_EXPORT_VERSION,
    name: payload.campaignName,
    payload,
  };
  assert.deepEqual(parseCampaignExport(current), current);
  assert.throws(() => parseCampaignExport({ ...current, version: 3 }));
});
