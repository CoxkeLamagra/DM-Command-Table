import type { DatabaseSync } from "node:sqlite";
import {
  adventureSchema,
  continuitySchema,
} from "../http/adventure-schemas.ts";
import {
  emptyAdventure,
  emptyContinuity,
  type CampaignAdventure,
  type SessionContinuity,
} from "../../domain/adventure.ts";
import { sanitizeRichText } from "../security/sanitize-rich-text.ts";
import { PublicApiError } from "../http/errors.ts";
export function scopeParty(
  database: DatabaseSync,
  campaignId: string,
  ids: string[],
): string[] {
  const lookup = database.prepare(
    "SELECT campaign_id AS campaignId FROM players WHERE id=?",
  );
  return ids.filter((id) => {
    const row = lookup.get(id) as { campaignId: string } | undefined;
    if (row && row.campaignId !== campaignId)
      throw new PublicApiError("Party records must belong to this campaign.");
    return !!row;
  });
}
export function cleanAdventure(
  database: DatabaseSync,
  campaignId: string,
  value: CampaignAdventure | undefined,
): CampaignAdventure {
  const data = adventureSchema.parse(value ?? emptyAdventure());
  return {
    ...data,
    threads: data.threads.map((thread) => ({
      ...thread,
      notes: sanitizeRichText(thread.notes),
    })),
    partyPresets: data.partyPresets.map((preset) => ({
      ...preset,
      playerIds: scopeParty(database, campaignId, preset.playerIds),
    })),
  };
}
export function cleanContinuity(
  database: DatabaseSync,
  campaignId: string,
  value: SessionContinuity | undefined,
): SessionContinuity {
  const data = continuitySchema.parse(value ?? emptyContinuity());
  const row = database
    .prepare("SELECT adventure FROM campaigns WHERE id=?")
    .get(campaignId) as { adventure: string };
  const threads = new Set(
    adventureSchema
      .parse(JSON.parse(row.adventure))
      .threads.map((thread) => thread.id),
  );
  if (data.threadIds.some((id) => !threads.has(id)))
    throw new PublicApiError("Session threads must belong to this campaign.");
  return {
    ...data,
    recap: sanitizeRichText(data.recap),
    rewards: sanitizeRichText(data.rewards),
    scenes: data.scenes.map((scene) => ({
      ...scene,
      notes: sanitizeRichText(scene.notes),
    })),
    attendanceIds: scopeParty(database, campaignId, data.attendanceIds),
  };
}
export function continuityText(value?: SessionContinuity): string[] {
  return value
    ? [
        value.recap,
        value.rewards,
        ...value.scenes.flatMap((scene) => [scene.title, scene.notes]),
      ]
    : [];
}
