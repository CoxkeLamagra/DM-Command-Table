export const MAX_CAMPAIGN_PAYLOAD_LENGTH = 1_500_000;

export function serialiseCampaignPayload(payload: unknown): string {
  return JSON.stringify(payload ?? {});
}

export function isCampaignPayloadTooLarge(payload: unknown): boolean {
  return serialiseCampaignPayload(payload).length > MAX_CAMPAIGN_PAYLOAD_LENGTH;
}

export function normaliseCampaignName(
  value: string | undefined,
  fallback: string,
): string {
  return (value ?? fallback).trim().slice(0, 120) || fallback;
}

export function normaliseUpdatedCampaignName(
  value: string | undefined,
): string {
  return (value ?? "Campaign").slice(0, 120);
}
