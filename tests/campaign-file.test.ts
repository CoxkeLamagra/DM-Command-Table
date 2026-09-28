import assert from "node:assert/strict";
import test from "node:test";
import { campaignExportFilename, createCampaignExport } from "../features/campaign/campaign-file.ts";
import { parseCampaignExport } from "../features/campaign/schema.ts";
import type { CampaignState } from "../features/campaign/types.ts";
import { createStarterCampaign } from "../lib/starter-campaign.ts";

test("campaign export creation retains the canonical v4 document", () => {
  const payload = createStarterCampaign<CampaignState>();
  const document = createCampaignExport("My Campaign", payload);
  assert.deepEqual(parseCampaignExport(document), document);
  assert.equal(campaignExportFilename("My Campaign"), "my-campaign.json");
  assert.equal(campaignExportFilename("---"), "-.json");
});
