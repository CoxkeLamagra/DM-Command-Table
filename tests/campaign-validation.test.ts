import assert from "node:assert/strict";
import test from "node:test";
import {
  isCampaignPayloadTooLarge,
  normaliseCampaignName,
  normaliseUpdatedCampaignName,
} from "../server/campaigns/validation.ts";

test("campaign names retain the existing trim, fallback, and length rules", () => {
  assert.equal(
    normaliseCampaignName("  My campaign  ", "Fallback"),
    "My campaign",
  );
  assert.equal(normaliseCampaignName("   ", "Fallback"), "Fallback");
  assert.equal(normaliseCampaignName("x".repeat(140), "Fallback").length, 120);
  assert.equal(normaliseUpdatedCampaignName("   "), "   ");
});

test("campaign payload limit remains enforced", () => {
  assert.equal(isCampaignPayloadTooLarge({ note: "small" }), false);
  assert.equal(
    isCampaignPayloadTooLarge({ note: "x".repeat(1_500_001) }),
    true,
  );
});
