import {
  CAMPAIGN_EXPORT_FORMAT,
  CAMPAIGN_EXPORT_VERSION,
  parseCampaignExport,
} from "./schema.ts";
import type { CampaignState } from "./types.ts";

export function createCampaignExport(name: string, payload: CampaignState) {
  return {
    format: CAMPAIGN_EXPORT_FORMAT,
    version: CAMPAIGN_EXPORT_VERSION,
    name,
    payload,
  } as const;
}

export function campaignExportFilename(name: string): string {
  return `${name.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "campaign"}.json`;
}

export function downloadCampaignExport(name: string, payload: CampaignState): void {
  const blob = new Blob([JSON.stringify(createCampaignExport(name, payload), null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = campaignExportFilename(name);
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function readCampaignExport(file: File) {
  return parseCampaignExport(JSON.parse(await file.text()));
}
