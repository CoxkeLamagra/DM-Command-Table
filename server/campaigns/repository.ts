import { getDatabase } from "../../db/sqlite.ts";
import { runTransaction } from "../../db/transaction.ts";
import { normaliseUsername, type LocalUser } from "../auth/credentials.ts";

export type CampaignRole = "owner" | "editor" | "viewer";
type CountRow = { count: number };
type IdRow = { id: string };
type AccessRow = { role: CampaignRole };
type LegacyRow = { payload: string; updatedAt: number };
type CampaignRow = {
  id: string;
  name: string;
  payload: string;
  updatedAt: number;
  role: CampaignRole;
  shared: number;
};

export function connectPendingMemberships(user: LocalUser): void {
  getDatabase()
    .prepare(
      "UPDATE campaign_members SET user_id = ? WHERE user_id IS NULL AND invite_email = ?",
    )
    .run(user.userId, user.username);
}

export function getCampaignAccess(
  campaignId: string,
  userId: string,
): CampaignRole | null {
  const row = getDatabase()
    .prepare(
      "SELECT CASE WHEN c.owner_id = ? THEN 'owner' ELSE m.role END AS role FROM campaigns c LEFT JOIN campaign_members m ON m.campaign_id = c.id AND m.user_id = ? WHERE c.id = ? AND (c.owner_id = ? OR m.user_id = ?) LIMIT 1",
    )
    .get(userId, userId, campaignId, userId, userId) as AccessRow | undefined;
  return row?.role ?? null;
}

export function migrateSoleLegacyCampaign(user: LocalUser): void {
  const db = getDatabase();
  const owned = db
    .prepare("SELECT COUNT(*) AS count FROM campaigns WHERE owner_id = ?")
    .get(user.userId) as CountRow;
  const knownUsers = db
    .prepare("SELECT COUNT(*) AS count FROM users")
    .get() as CountRow;
  if (owned.count !== 0 || knownUsers.count !== 1) return;

  const legacy = db
    .prepare(
      "SELECT payload, updated_at AS updatedAt FROM campaign_states WHERE id = 'main-campaign' LIMIT 1",
    )
    .get() as LegacyRow | undefined;
  if (!legacy) return;

  const parsed = JSON.parse(legacy.payload) as { campaignName?: string };
  const now = legacy.updatedAt || Date.now();
  db.prepare(
    "INSERT INTO campaigns (id, owner_id, name, payload, updated_at, created_at) VALUES (?, ?, ?, ?, ?, ?)",
  ).run(
    crypto.randomUUID(),
    user.userId,
    parsed.campaignName ?? "Imported campaign",
    legacy.payload,
    now,
    now,
  );
}

export function listCampaigns(userId: string) {
  const rows = getDatabase()
    .prepare(
      `SELECT c.id, c.name, c.payload, c.updated_at AS updatedAt,
        CASE WHEN c.owner_id = ? THEN 'owner' ELSE m.role END AS role,
        CASE WHEN EXISTS(SELECT 1 FROM campaign_members x WHERE x.campaign_id = c.id) THEN 1 ELSE 0 END AS shared
       FROM campaigns c
       LEFT JOIN campaign_members m ON m.campaign_id = c.id AND m.user_id = ?
       WHERE c.owner_id = ? OR m.user_id = ?
       ORDER BY c.updated_at DESC`,
    )
    .all(userId, userId, userId, userId) as CampaignRow[];
  return rows.map((row) => ({
    ...row,
    payload: JSON.parse(row.payload) as unknown,
    updatedAt: new Date(row.updatedAt).toISOString(),
    shared: Boolean(row.shared),
  }));
}

export function createCampaign(userId: string, name: string, payload: unknown) {
  const id = crypto.randomUUID();
  const now = Date.now();
  getDatabase()
    .prepare(
      "INSERT INTO campaigns (id, owner_id, name, payload, updated_at, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .run(id, userId, name, JSON.stringify(payload), now, now);
  return {
    id,
    name,
    payload,
    role: "owner" as const,
    shared: false,
    updatedAt: new Date(now).toISOString(),
  };
}

export function updateCampaign(
  id: string,
  name: string,
  payload: unknown,
): string {
  const now = Date.now();
  getDatabase()
    .prepare(
      "UPDATE campaigns SET name = ?, payload = ?, updated_at = ? WHERE id = ?",
    )
    .run(name, JSON.stringify(payload), now, id);
  return new Date(now).toISOString();
}

export function shareCampaign(
  id: string,
  usernameValue: string,
  role: "viewer" | "editor",
) {
  const db = getDatabase();
  const username = normaliseUsername(usernameValue);
  const known = db
    .prepare("SELECT id FROM users WHERE username = ? LIMIT 1")
    .get(username) as IdRow | undefined;
  if (!known) return false;
  db.prepare(
    "INSERT INTO campaign_members (campaign_id, user_id, invite_email, role, added_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(campaign_id, invite_email) DO UPDATE SET user_id = excluded.user_id, role = excluded.role",
  ).run(id, known.id, username, role, Date.now());
  return true;
}

export function deleteCampaign(id: string): void {
  const db = getDatabase();
  runTransaction(db, () => {
    db.prepare("DELETE FROM campaign_members WHERE campaign_id = ?").run(id);
    db.prepare("DELETE FROM campaigns WHERE id = ?").run(id);
  });
}
