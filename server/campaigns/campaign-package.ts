import { exportTooLarge, exportByteLimit } from "./export-budget.ts";
import { statement } from "../../db/statements.ts";
import { z } from "zod";
import type { DatabaseSync } from "node:sqlite";
import {
  exportCampaign,
  importCampaign,
  validatePortableCampaign,
} from "./campaign-portable.ts";
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
  const packageLimit = exportByteLimit();
  const assets = [];
  let encodedSize = Buffer.byteLength(
    JSON.stringify({
      format: "dmct-campaign-package",
      version: 1,
      campaign,
      assets: [],
    }),
  );
  const tooLarge = exportTooLarge;
  if (encodedSize > packageLimit) throw tooLarge();
  for (const id of new Set(imageIds(campaign))) {
    const overhead =
      Buffer.byteLength(JSON.stringify({ id, name: `${id}.webp`, bytes: "" })) +
      (assets.length ? 1 : 0);
    const maximumImageBytes =
      Math.floor((packageLimit - encodedSize - overhead) / 4) * 3;
    if (maximumImageBytes < 0) throw tooLarge();
    const image = await readScreenshot(
      database,
      id,
      actorId,
      false,
      maximumImageBytes,
    );
    if (!image)
      throw new PublicApiError(
        "A referenced image is missing or inaccessible. Repair it before exporting.",
        409,
      );
    const asset = {
      id,
      name: `${id}.webp`,
      bytes: image.bytes.toString("base64"),
    };
    encodedSize +=
      Buffer.byteLength(JSON.stringify(asset)) + (assets.length ? 1 : 0);
    if (encodedSize > packageLimit) throw tooLarge();
    assets.push(asset);
  }
  const result = {
    format: "dmct-campaign-package" as const,
    version: 1,
    campaign,
    assets,
  };
  return result;
}
export async function importCampaignPackage(
  database: DatabaseSync,
  actorId: string,
  value: unknown,
) {
  const parsed = packageSchema.parse(value);
  const validatedCampaign = validatePortableCampaign(parsed.campaign);
  const referenced = new Set(imageIds(validatedCampaign));
  const ids = new Set(parsed.assets.map((asset) => asset.id));
  if (
    ids.size !== parsed.assets.length ||
    [...referenced].some((id) => !ids.has(id)) ||
    parsed.assets.some((asset) => !referenced.has(asset.id))
  )
    throw new PublicApiError(
      "The package has missing, duplicate or unused images.",
    );
  const created: string[] = [];
  const mapping = new Map<string, string>();
  try {
    for (const asset of parsed.assets) {
      if (
        !/^[A-Za-z0-9+/]*={0,2}$/.test(asset.bytes) ||
        asset.bytes.length % 4 !== 0
      )
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
      statement(database, "UPDATE screenshots SET staging=1 WHERE id=?").run(
        image.id,
      );
    }
    return runTransaction(database, () => {
      const campaign = importCampaign(
        database,
        actorId,
        remap(validatedCampaign, mapping),
      );
      for (const id of created)
        statement(database, "UPDATE screenshots SET staging=0 WHERE id=?").run(
          id,
        );
      return campaign;
    });
  } catch (error) {
    for (const id of created)
      await deleteScreenshot(database, id, actorId, false);
    throw error;
  }
}
