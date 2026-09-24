import { createStarterCampaign } from "@/lib/starter-campaign";
import type { CampaignState } from "./types";

export const starterCampaign = createStarterCampaign<CampaignState>();

export function createEmptyCampaign(): CampaignState {
  return {
    ...structuredClone(starterCampaign),
    campaignName: "New campaign",
    campaignNotes: "",
    encounterName: "New encounter",
    round: 1,
    turn: 0,
    combatants: [],
    players: [],
    sessions: [],
    story: [],
  };
}
