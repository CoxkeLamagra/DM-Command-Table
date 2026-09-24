import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { getDatabase } from "@/db/sqlite";

const MIME_EXTENSIONS: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
  "image/gif": ".gif",
};
export const MAX_SCREENSHOT_BYTES = 8 * 1024 * 1024;

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
  return Boolean(MIME_EXTENSIONS[mimeType]);
}

export async function saveScreenshot(
  file: File,
  userId: string,
): Promise<ScreenshotRecord> {
  const id = crypto.randomUUID();
  const filename = `${id}${MIME_EXTENSIONS[file.type]}`;
  const directory = screenshotDirectory();
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(/* turbopackIgnore: true */ directory, filename), Buffer.from(await file.arrayBuffer()), {
    flag: "wx",
  });
  const createdAt = Date.now();
  try {
    getDatabase()
      .prepare(
        "INSERT INTO screenshots (id, filename, original_name, mime_type, size, uploaded_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
      .run(id, filename, cleanName(file.name), file.type, file.size, userId, createdAt);
  } catch (error) {
    await unlink(path.join(/* turbopackIgnore: true */ directory, filename)).catch(() => undefined);
    throw error;
  }
  return toRecord({
    id,
    filename,
    name: cleanName(file.name),
    mimeType: file.type,
    size: file.size,
    uploadedBy: userId,
    createdAt,
  });
}

export function listScreenshots(): ScreenshotRecord[] {
  const rows = getDatabase()
    .prepare(
      `SELECT s.id, s.filename, s.original_name AS name, s.mime_type AS mimeType,
              s.size, COALESCE(u.username, 'deleted user') AS uploadedBy,
              s.created_at AS createdAt
       FROM screenshots s
       LEFT JOIN users u ON u.id = s.uploaded_by
       ORDER BY s.created_at DESC`,
    )
    .all() as ScreenshotRow[];
  return rows.map(toRecord);
}

export async function readScreenshot(id: string): Promise<{
  bytes: Buffer;
  mimeType: string;
  name: string;
} | null> {
  const row = getDatabase()
    .prepare(
      "SELECT filename, original_name AS name, mime_type AS mimeType FROM screenshots WHERE id = ? LIMIT 1",
    )
    .get(id) as { filename: string; name: string; mimeType: string } | undefined;
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
