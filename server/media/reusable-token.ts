import { createHash } from "node:crypto";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import type { DatabaseSync } from "node:sqlite";
import type { Screenshot } from "./screenshots.ts";
import { storagePaths } from "../config.ts";

export function tokenHash(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

// Reuse never grants access to another account's uploads. Matching actual
// normalized bytes also avoids trusting remote URLs, names or client hashes.
export function reusableToken(
  database: DatabaseSync,
  userId: string,
  hash: string,
): Screenshot | undefined {
  const row = database
    .prepare(
      `SELECT id,original_name AS name,size,created_at AS createdAt FROM screenshots
    WHERE uploaded_by=? AND content_hash=? AND staging=0 ORDER BY created_at,id LIMIT 1`,
    )
    .get(userId, hash) as
    { id: string; name: string; size: number; createdAt: number } | undefined;
  return row
    ? {
        ...row,
        uploadedBy: userId,
        createdAt: new Date(row.createdAt).toISOString(),
        url: `/api/screenshots/${row.id}`,
      }
    : undefined;
}

export async function findReusableToken(
  database: DatabaseSync,
  userId: string,
  bytes: Buffer,
): Promise<Screenshot | undefined> {
  const hash = tokenHash(bytes);
  const cached = reusableToken(database, userId, hash);
  if (cached) {
    const row = database
      .prepare("SELECT filename FROM screenshots WHERE id=?")
      .get(cached.id) as { filename: string };
    try {
      await access(filePath(row.filename));
      return cached;
    } catch {
      database
        .prepare("UPDATE screenshots SET content_hash=NULL WHERE id=?")
        .run(cached.id);
    }
  }
  // Existing installations have no hashes. Scan every same-size candidate so
  // an older token cannot be missed; hash one file at a time to bound memory.
  const candidates = database
    .prepare(
      `SELECT id,filename FROM screenshots WHERE uploaded_by=? AND staging=0 AND content_hash IS NULL AND size=? ORDER BY created_at,id`,
    )
    .all(userId, bytes.length) as { id: string; filename: string }[];
  for (const row of candidates) {
    try {
      const storedHash = tokenHash(await readFile(filePath(row.filename)));
      database
        .prepare(
          "UPDATE screenshots SET content_hash=? WHERE id=? AND uploaded_by=? AND staging=0",
        )
        .run(storedHash, row.id, userId);
      if (storedHash === hash) return reusableToken(database, userId, hash);
    } catch {
      /* Missing legacy files do not prevent a fresh token upload. */
    }
  }
}
function filePath(filename: string) {
  if (path.basename(filename) !== filename)
    throw new Error("Invalid screenshot filename.");
  return path.join(storagePaths().uploads, filename);
}
