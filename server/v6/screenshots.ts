import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import type { DatabaseSync } from "node:sqlite";
import { runTransaction } from "../../db/transaction.ts";
import { PublicApiError } from "./errors.ts";
import { getV6ServerSettings } from "./server-settings.ts";
import { requireCampaignEdit } from "./access.ts";
export type V6Screenshot = {
  id: string;
  name: string;
  size: number;
  uploadedBy: string;
  createdAt: string;
  url: string;
};
sharp.block({
  operation: [
    "VipsForeignLoadSvg",
    "VipsForeignLoadSvgFile",
    "VipsForeignLoadSvgBuffer",
  ],
});

let activeImageDecodes = 0;
const MAX_IMAGE_DECODES = 2;
const TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
export function listV6Screenshots(
  database: DatabaseSync,
  userId: string,
  admin: boolean,
): V6Screenshot[] {
  const rows = database
    .prepare(
      `SELECT DISTINCT s.id, s.original_name AS name, s.size, u.username AS uploadedBy, s.created_at AS createdAt FROM screenshots s JOIN users u ON u.id=s.uploaded_by LEFT JOIN screenshot_references r ON r.screenshot_id=s.id LEFT JOIN campaigns c ON c.id=r.campaign_id LEFT JOIN campaign_members m ON m.campaign_id=c.id AND m.user_id=? WHERE ?=1 OR s.uploaded_by=? OR c.owner_id=? OR m.user_id=? ORDER BY s.created_at DESC`,
    )
    .all(userId, admin ? 1 : 0, userId, userId, userId) as Array<
    Omit<V6Screenshot, "createdAt" | "url"> & { createdAt: number }
  >;
  return rows.map((row) => ({
    ...row,
    createdAt: new Date(row.createdAt).toISOString(),
    url: `/api/v6-screenshots/${row.id}`,
  }));
}
export async function saveV6Screenshot(
  database: DatabaseSync,
  file: File,
  userId: string,
): Promise<V6Screenshot> {
  const settings = getV6ServerSettings(database);
  const uploadLimit = settings.uploadLimitMb * 1024 * 1024;
  if (!TYPES.has(file.type) || file.size < 1 || file.size > uploadLimit)
    throw new PublicApiError(
      `Select a PNG, JPEG, WebP, or GIF image no larger than ${settings.uploadLimitMb} MB.`,
    );
  const id = crypto.randomUUID();
  const filename = `${id}.webp`;
  let bytes: Buffer;
  if (activeImageDecodes >= MAX_IMAGE_DECODES)
    throw new PublicApiError(
      "Image processing is busy. Please try again shortly.",
      503,
    );
  activeImageDecodes += 1;
  try {
    const image = sharp(Buffer.from(await file.arrayBuffer()), {
      animated: true,
      limitInputPixels: 40_000_000,
    });
    const metadata = await image.metadata();
    if (!["png", "jpeg", "webp", "gif"].includes(metadata.format ?? ""))
      throw new Error("Unsupported decoded image format");
    bytes = await image.rotate().webp({ quality: 88 }).toBuffer();
  } catch {
    throw new PublicApiError(
      "The uploaded file is not a valid supported image.",
      415,
    );
  } finally {
    activeImageDecodes -= 1;
  }
  const quota = settings.screenshotQuotaMb * 1024 * 1024;
  const globalQuota = settings.screenshotGlobalQuotaMb * 1024 * 1024;
  const directory = uploadDirectory();
  await mkdir(directory, { recursive: true });
  const now = Date.now();
  try {
    await writeFile(path.join(directory, filename), bytes, {
      flag: "wx",
      mode: 0o600,
    });
    runTransaction(database, () => {
      const used = (
        database
          .prepare(
            "SELECT COALESCE(SUM(size),0) AS size FROM screenshots WHERE uploaded_by=?",
          )
          .get(userId) as { size: number }
      ).size;
      const globalUsed = (
        database
          .prepare("SELECT COALESCE(SUM(size),0) AS size FROM screenshots")
          .get() as { size: number }
      ).size;
      if (used + bytes.length > quota)
        throw new PublicApiError(
          "Your screenshot storage quota has been reached.",
          413,
        );
      if (globalUsed + bytes.length > globalQuota)
        throw new PublicApiError(
          "The server screenshot storage quota has been reached.",
          413,
        );
      database
        .prepare(
          "INSERT INTO screenshots (id,filename,original_name,mime_type,size,uploaded_by,created_at) VALUES (?,?,?,?,?,?,?)",
        )
        .run(
          id,
          filename,
          path.basename(file.name).slice(0, 160) || "screenshot",
          "image/webp",
          bytes.length,
          userId,
          now,
        );
    });
  } catch (error) {
    database.prepare("DELETE FROM screenshots WHERE id = ?").run(id);
    await unlink(path.join(directory, filename)).catch(() => undefined);
    throw error;
  }
  return {
    id,
    name: file.name,
    size: bytes.length,
    uploadedBy: userId,
    createdAt: new Date(now).toISOString(),
    url: `/api/v6-screenshots/${id}`,
  };
}
export async function readV6Screenshot(
  database: DatabaseSync,
  id: string,
  userId: string,
  admin: boolean,
) {
  const row = database
    .prepare(
      `SELECT s.filename,s.mime_type AS mimeType FROM screenshots s WHERE s.id=? AND (?=1 OR s.uploaded_by=? OR EXISTS (SELECT 1 FROM screenshot_references r JOIN campaigns c ON c.id=r.campaign_id LEFT JOIN campaign_members m ON m.campaign_id=c.id AND m.user_id=? WHERE r.screenshot_id=s.id AND (c.owner_id=? OR m.user_id=?)))`,
    )
    .get(id, admin ? 1 : 0, userId, userId, userId, userId) as
    { filename: string; mimeType: string } | undefined;
  if (!row) return null;
  try {
    return {
      bytes: await readFile(screenshotPath(row.filename)),
      mimeType: row.mimeType,
    };
  } catch {
    return null;
  }
}
export async function deleteV6Screenshot(
  database: DatabaseSync,
  id: string,
  userId: string,
  admin: boolean,
): Promise<"deleted" | "referenced" | "missing"> {
  const row = database
    .prepare(
      "SELECT filename FROM screenshots WHERE id=? AND (?=1 OR uploaded_by=?)",
    )
    .get(id, admin ? 1 : 0, userId) as { filename: string } | undefined;
  if (!row) return "missing";
  const references = (
    database
      .prepare(
        "SELECT COUNT(*) AS count FROM screenshot_references WHERE screenshot_id=?",
      )
      .get(id) as { count: number }
  ).count;
  if (references > 0) return "referenced";
  database.prepare("DELETE FROM screenshots WHERE id=?").run(id);
  await unlink(screenshotPath(row.filename)).catch(() => undefined);
  return "deleted";
}

export function syncV6ScreenshotReferences(
  database: DatabaseSync,
  campaignId: string,
  actorUserId: string,
  resourceType: string,
  resourceId: string,
  ...richText: string[]
): void {
  requireCampaignEdit(database, campaignId, actorUserId);
  const ids = new Set(richText.flatMap(extractScreenshotIds));
  const visible = database.prepare(
    `SELECT s.id FROM screenshots s WHERE s.id=? AND (s.uploaded_by=? OR EXISTS (SELECT 1 FROM screenshot_references r JOIN campaigns c ON c.id=r.campaign_id LEFT JOIN campaign_members m ON m.campaign_id=c.id AND m.user_id=? WHERE r.screenshot_id=s.id AND (c.owner_id=? OR m.user_id=?))) LIMIT 1`,
  );
  database
    .prepare(
      "DELETE FROM screenshot_references WHERE campaign_id=? AND resource_type=? AND resource_id=?",
    )
    .run(campaignId, resourceType, resourceId);
  const insert = database.prepare(
    "INSERT INTO screenshot_references (screenshot_id,campaign_id,resource_type,resource_id,created_at) VALUES (?,?,?,?,?)",
  );
  for (const id of ids)
    if (visible.get(id, actorUserId, actorUserId, actorUserId, actorUserId))
      insert.run(id, campaignId, resourceType, resourceId, Date.now());
}

export function extractScreenshotIds(value: string): string[] {
  return [
    ...value.matchAll(
      /<img\b[^>]*\bsrc=["']\/api\/v6-screenshots\/([0-9a-f-]+)["'][^>]*>/gi,
    ),
  ].map((match) => match[1]);
}
function uploadDirectory() {
  const dbPath = path.resolve(
    /* turbopackIgnore: true */ process.env.DM_COMMAND_TABLE_V6_DB_PATH ||
      path.join(process.cwd(), "data", "dm-command-table-v6.sqlite"),
  );
  return process.env.DM_COMMAND_TABLE_V6_UPLOAD_PATH
    ? path.resolve(
        /* turbopackIgnore: true */ process.env.DM_COMMAND_TABLE_V6_UPLOAD_PATH,
      )
    : path.join(path.dirname(dbPath), "uploads-v6");
}
function screenshotPath(filename: string) {
  const safe = path.basename(filename);
  if (safe !== filename) throw new Error("Invalid screenshot filename.");
  return path.join(uploadDirectory(), safe);
}
