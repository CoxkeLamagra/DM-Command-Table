import { z } from "zod";
import type { DatabaseSync } from "node:sqlite";
import { exportCampaign, importCampaign } from "./campaign-portable.ts";
import {
  readScreenshot,
  saveScreenshot,
  deleteScreenshot,
  extractScreenshotIds,
} from "../media/screenshots.ts";
import { runTransaction } from "../../db/transaction.ts";
import { PublicApiError } from "../http/errors.ts";
import { CAMPAIGN_PACKAGE_LIMIT } from "../../domain/limits.ts";
const packageSchema = z.object({
  format: z.literal("dmct-campaign-package"),
  version: z.literal(1),
  campaign: z.unknown(),
  assets: z
    .array(
      z.object({
        id: z.string().uuid(),
        bytes: z.string().max(CAMPAIGN_PACKAGE_LIMIT),
        name: z.string().max(160),
      }),
    )
    .max(1000),
});
function imageIds(value: unknown): string[] {
  if (typeof value === "string") return extractScreenshotIds(value);
  if (Array.isArray(value)) return value.flatMap(imageIds);
  if (value && typeof value === "object")
    return Object.values(value).flatMap(imageIds);
  return [];
}
function remap(value: unknown, ids: Map<string, string>): unknown {
  if (typeof value === "string")
    return value.replace(/\/api\/screenshots\/([0-9a-f-]+)/gi, (match, id) =>
      ids.has(id) ? `/api/screenshots/${ids.get(id)}` : match,
    );
  if (Array.isArray(value)) return value.map((entry) => remap(entry, ids));
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, remap(entry, ids)]),
    );
  return value;
}
export async function exportCampaignPackage(
  database: DatabaseSync,
  campaignId: string,
  actorId: string,
) {
  const campaign = exportCampaign(database, campaignId, actorId);
  const assets = [];
  for (const id of new Set(imageIds(campaign))) {
    const image = await readScreenshot(database, id, actorId, false);
    if (!image)
      throw new PublicApiError(
        "A referenced image is missing or inaccessible. Repair it before exporting.",
        409,
      );
    assets.push({
      id,
      name: `${id}.webp`,
      bytes: image.bytes.toString("base64"),
    });
  }
  const result = {
    format: "dmct-campaign-package" as const,
    version: 1,
    campaign,
    assets,
  };
  if (Buffer.byteLength(JSON.stringify(result)) > CAMPAIGN_PACKAGE_LIMIT)
    throw new PublicApiError(
      "Campaign packages must be no larger than 50 MB. Use a full server backup for larger campaigns.",
      413,
    );
  return result;
}
export async function importCampaignPackage(
  database: DatabaseSync,
  actorId: string,
  value: unknown,
) {
  const parsed = packageSchema.parse(value);
  const ids = new Set(parsed.assets.map((asset) => asset.id));
  if (
    ids.size !== parsed.assets.length ||
    imageIds(parsed.campaign).some((id) => !ids.has(id))
  )
    throw new PublicApiError("The package has missing or duplicate images.");
  const created: string[] = [];
  const mapping = new Map<string, string>();
  try {
    for (const asset of parsed.assets) {
      if (!/^[A-Za-z0-9+/]*={0,2}$/.test(asset.bytes))
        throw new PublicApiError("Invalid encoded image");
      const image = await saveScreenshot(
        database,
        new File([Buffer.from(asset.bytes, "base64")], asset.name, {
          type: "image/webp",
        }),
        actorId,
      );
      created.push(image.id);
      mapping.set(asset.id, image.id);
      database
        .prepare("UPDATE screenshots SET staging=1 WHERE id=?")
        .run(image.id);
    }
    return runTransaction(database, () => {
      const campaign = importCampaign(
        database,
        actorId,
        remap(parsed.campaign, mapping),
      );
      for (const id of created)
        database.prepare("UPDATE screenshots SET staging=0 WHERE id=?").run(id);
      return campaign;
    });
  } catch (error) {
    for (const id of created)
      await deleteScreenshot(database, id, actorId, false);
    throw error;
  }
}
