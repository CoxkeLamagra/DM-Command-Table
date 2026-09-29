import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import type { DatabaseSync } from "node:sqlite";
export type V6Screenshot = { id: string; name: string; size: number; uploadedBy: string; createdAt: string; url: string };
const MAX = 8 * 1024 * 1024; const TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
export function listV6Screenshots(database: DatabaseSync, userId: string, admin: boolean): V6Screenshot[] { const rows = database.prepare(`SELECT s.id, s.original_name AS name, s.size, u.username AS uploadedBy, s.created_at AS createdAt FROM screenshots s JOIN users u ON u.id=s.uploaded_by WHERE ?=1 OR s.uploaded_by=? ORDER BY s.created_at DESC`).all(admin ? 1 : 0, userId) as Array<Omit<V6Screenshot,"createdAt"|"url"> & {createdAt:number}>; return rows.map((row) => ({ ...row, createdAt: new Date(row.createdAt).toISOString(), url: `/api/v6-screenshots/${row.id}` })); }
export async function saveV6Screenshot(database: DatabaseSync, file: File, userId: string): Promise<V6Screenshot> {
  if (!TYPES.has(file.type) || file.size < 1 || file.size > MAX)
    throw new Error("Select a PNG, JPEG, WebP, or GIF image no larger than 8 MB.");
  const id = crypto.randomUUID();
  const filename = `${id}.webp`;
  const bytes = await sharp(Buffer.from(await file.arrayBuffer()), { animated: true, limitInputPixels: 40_000_000 }).rotate().webp({ quality: 88 }).toBuffer();
  const used = (database.prepare("SELECT COALESCE(SUM(size),0) AS size FROM screenshots WHERE uploaded_by=?").get(userId) as { size: number }).size;
  const configured = Number(process.env.DM_COMMAND_TABLE_SCREENSHOT_QUOTA_MB);
  const quota = (Number.isFinite(configured) && configured > 0 ? configured : 100) * 1024 * 1024;
  if (used + bytes.length > quota) throw new Error("Your screenshot storage quota has been reached.");
  const directory = uploadDirectory();
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, filename), bytes, { flag: "wx" });
  const now = Date.now();
  try {
    database.prepare("INSERT INTO screenshots (id,filename,original_name,mime_type,size,uploaded_by,created_at) VALUES (?,?,?,?,?,?,?)").run(id, filename, path.basename(file.name).slice(0, 160) || "screenshot", "image/webp", bytes.length, userId, now);
  } catch (error) {
    await unlink(path.join(directory, filename)).catch(() => undefined);
    throw error;
  }
  return { id, name: file.name, size: bytes.length, uploadedBy: userId, createdAt: new Date(now).toISOString(), url: `/api/v6-screenshots/${id}` };
}
export async function readV6Screenshot(database: DatabaseSync,id:string,userId:string,admin:boolean){ const row=database.prepare("SELECT filename,mime_type AS mimeType FROM screenshots WHERE id=? AND (?=1 OR uploaded_by=?)").get(id,admin?1:0,userId) as {filename:string;mimeType:string}|undefined; if(!row)return null; try{return {bytes:await readFile(path.join(uploadDirectory(),row.filename)),mimeType:row.mimeType};}catch{return null;} }
export async function deleteV6Screenshot(database:DatabaseSync,id:string,userId:string,admin:boolean){const row=database.prepare("SELECT filename FROM screenshots WHERE id=? AND (?=1 OR uploaded_by=?)").get(id,admin?1:0,userId) as {filename:string}|undefined;if(!row)return false;database.prepare("DELETE FROM screenshots WHERE id=?").run(id);await unlink(path.join(uploadDirectory(),row.filename)).catch(()=>undefined);return true;}
function uploadDirectory(){const dbPath=path.resolve(/* turbopackIgnore: true */ process.env.DM_COMMAND_TABLE_V6_DB_PATH||path.join(process.cwd(),"data","dm-command-table-v6.sqlite"));return process.env.DM_COMMAND_TABLE_V6_UPLOAD_PATH?path.resolve(/* turbopackIgnore: true */ process.env.DM_COMMAND_TABLE_V6_UPLOAD_PATH):path.join(path.dirname(dbPath),"uploads-v6");}
