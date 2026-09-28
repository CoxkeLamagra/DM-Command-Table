import type { CampaignState } from "./types";

export type CampaignCopyMode = "campaign" | "template";

function copiedCampaignName(name: string, label: "Copy" | "Template") {
  const suffix = ` — ${label}`;
  const base = name.trim() || "Campaign";
  return `${base.slice(0, 120 - suffix.length)}${suffix}`;
}

export function createCampaignCopy(
  source: CampaignState,
  mode: CampaignCopyMode,
): CampaignState {
  const copy = structuredClone(source);

  if (mode === "campaign") {
    return {
      ...copy,
      campaignName: copiedCampaignName(source.campaignName, "Copy"),
    };
  }

  return {
    ...copy,
    campaignName: copiedCampaignName(source.campaignName, "Template"),
    encounterName: "New encounter",
    round: 1,
    turn: 0,
    combatants: [],
    players: [],
    sessions: copy.sessions.map((session) => ({
      ...session,
      done: false,
      status: "planned",
    })),
    story: copy.story.map((beat) => ({ ...beat, status: "planned" })),
  };
}
