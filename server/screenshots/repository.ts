import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { getDatabase } from "../../db/sqlite.ts";

const SUPPORTED_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);
export const MAX_SCREENSHOT_BYTES = 8 * 1024 * 1024;
export const DEFAULT_SCREENSHOT_QUOTA_BYTES = 100 * 1024 * 1024;

export type ScreenshotRecord = {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  uploadedBy: string;
  createdAt: string;
  url: string;
};

type ScreenshotRow = {
  id: string;
  filename: string;
  name: string;
  mimeType: string;
  size: number;
  uploadedBy: string;
  createdAt: number;
};

export function isSupportedScreenshotType(mimeType: string): boolean {
  return SUPPORTED_MIME_TYPES.has(mimeType);
}

export function screenshotQuotaBytes(): number {
  const configured = Number(process.env.DM_COMMAND_TABLE_SCREENSHOT_QUOTA_MB);
  return Number.isFinite(configured) && configured > 0
    ? Math.floor(configured * 1024 * 1024)
    : DEFAULT_SCREENSHOT_QUOTA_BYTES;
}

export function screenshotBytesUsed(userId: string): number {
  const row = getDatabase()
    .prepare("SELECT COALESCE(SUM(size), 0) AS size FROM screenshots WHERE uploaded_by = ?")
    .get(userId) as { size: number };
  return row.size;
}

export async function saveScreenshot(
  file: File,
  userId: string,
): Promise<ScreenshotRecord> {
  const id = crypto.randomUUID();
  const filename = `${id}.webp`;
  const directory = screenshotDirectory();
  const source = Buffer.from(await file.arrayBuffer());
  const bytes = await sharp(source, {
    animated: true,
    failOn: "warning",
    limitInputPixels: 40_000_000,
  })
    .rotate()
    .webp({ quality: 90 })
    .toBuffer();
  if (!bytes.length || bytes.length > MAX_SCREENSHOT_BYTES)
    throw new Error("The processed screenshot is too large.");
  if (screenshotBytesUsed(userId) + bytes.length > screenshotQuotaBytes())
    throw new Error("The screenshot storage quota has been reached.");
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(/* turbopackIgnore: true */ directory, filename), bytes, {
    flag: "wx",
  });
  const createdAt = Date.now();
  try {
    getDatabase()
      .prepare(
        "INSERT INTO screenshots (id, filename, original_name, mime_type, size, uploaded_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
      .run(id, filename, cleanName(file.name), "image/webp", bytes.length, userId, createdAt);
  } catch (error) {
    await unlink(path.join(/* turbopackIgnore: true */ directory, filename)).catch(() => undefined);
    throw error;
  }
  return toRecord({
    id,
    filename,
    name: cleanName(file.name),
    mimeType: "image/webp",
    size: bytes.length,
    uploadedBy: userId,
    createdAt,
  });
}

export function listScreenshots(userId: string, isAdmin = false): ScreenshotRecord[] {
  const rows = getDatabase()
    .prepare(
      `SELECT s.id, s.filename, s.original_name AS name, s.mime_type AS mimeType,
              s.size, COALESCE(u.username, 'deleted user') AS uploadedBy,
              s.created_at AS createdAt
       FROM screenshots s
       LEFT JOIN users u ON u.id = s.uploaded_by
       WHERE ? = 1 OR s.uploaded_by = ? OR EXISTS (
         SELECT 1 FROM campaigns c
         LEFT JOIN campaign_members m ON m.campaign_id = c.id AND m.user_id = ?
         WHERE (c.owner_id = ? OR m.user_id = ?)
           AND instr(c.payload, '[[screenshot:' || s.id || ']]') > 0
       )
       ORDER BY s.created_at DESC`,
    )
    .all(isAdmin ? 1 : 0, userId, userId, userId, userId) as ScreenshotRow[];
  return rows.map(toRecord);
}

export async function readScreenshot(id: string, userId: string, isAdmin = false): Promise<{
  bytes: Buffer;
  mimeType: string;
  name: string;
} | null> {
  const row = getDatabase()
    .prepare(
      `SELECT s.filename, s.original_name AS name, s.mime_type AS mimeType
       FROM screenshots s
       WHERE s.id = ? AND (
         ? = 1 OR s.uploaded_by = ? OR EXISTS (
           SELECT 1 FROM campaigns c
           LEFT JOIN campaign_members m ON m.campaign_id = c.id AND m.user_id = ?
           WHERE (c.owner_id = ? OR m.user_id = ?)
             AND instr(c.payload, '[[screenshot:' || s.id || ']]') > 0
         )
       ) LIMIT 1`,
    )
    .get(id, isAdmin ? 1 : 0, userId, userId, userId, userId) as
    | { filename: string; name: string; mimeType: string }
    | undefined;
  if (!row) return null;
  try {
    return {
      bytes: await readFile(path.join(/* turbopackIgnore: true */ screenshotDirectory(), row.filename)),
      mimeType: row.mimeType,
      name: row.name,
    };
  } catch {
    return null;
  }
}

export async function deleteScreenshot(id: string): Promise<boolean> {
  const db = getDatabase();
  const row = db
    .prepare("SELECT filename FROM screenshots WHERE id = ? LIMIT 1")
    .get(id) as { filename: string } | undefined;
  if (!row) return false;
  db.prepare("DELETE FROM screenshots WHERE id = ?").run(id);
  await unlink(path.join(/* turbopackIgnore: true */ screenshotDirectory(), row.filename)).catch(() => undefined);
  return true;
}

function screenshotDirectory(): string {
  if (process.env.DM_COMMAND_TABLE_UPLOAD_PATH)
    return path.resolve(/* turbopackIgnore: true */ process.env.DM_COMMAND_TABLE_UPLOAD_PATH);
  const databasePath = path.resolve(
    /* turbopackIgnore: true */
    process.env.DM_COMMAND_TABLE_DB_PATH ||
      path.join(process.cwd(), "data", "dm-command-table.sqlite"),
  );
  return path.join(path.dirname(databasePath), "uploads");
}

function cleanName(value: string): string {
  return path.basename(value).replace(/[\u0000-\u001f]/g, "").slice(0, 160) || "screenshot";
}

function toRecord(row: ScreenshotRow): ScreenshotRecord {
  return {
    id: row.id,
    name: row.name,
    mimeType: row.mimeType,
    size: row.size,
    uploadedBy: row.uploadedBy,
    createdAt: new Date(row.createdAt).toISOString(),
    url: `/api/screenshots/${row.id}`,
  };
}
