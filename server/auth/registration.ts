import { getDatabase } from "../../db/sqlite.ts";
import { createStarterCampaign } from "../../lib/starter-campaign.ts";
import {
  findLocalUser,
  hashPassword,
  type LocalUser,
} from "./credentials.ts";

export type RegistrationResult =
  | { user: LocalUser }
  | { error: string; status: 409 };

export function registerLocalUser(input: {
  username: string;
  displayName: string;
  password: string;
}): RegistrationResult {
  const { username, displayName, password } = input;
  const db = getDatabase();
  if (findLocalUser(username)) return duplicateUsername();

  const now = Date.now();
  const passwordHash = hashPassword(password);
  const accountCount = db
    .prepare("SELECT COUNT(*) AS count FROM users")
    .get() as { count: number };
  const id = crypto.randomUUID();
  const isAdmin = accountCount.count === 0;

  try {
    db.prepare(
      "INSERT INTO users (id, display_name, username, password_hash, is_admin, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
    ).run(id, displayName, username, passwordHash, isAdmin ? 1 : 0, now);
  } catch {
    return duplicateUsername();
  }

  db.prepare(
    "UPDATE campaign_members SET user_id = ? WHERE user_id IS NULL AND member_username = ?",
  ).run(id, username);
  createInitialCampaign(id, now);
  return { user: { userId: id, username, displayName, isAdmin } };
}

function createInitialCampaign(userId: string, now: number): void {
  const db = getDatabase();
  const starter = createStarterCampaign<Record<string, unknown>>();
  db.prepare(
    "INSERT INTO campaigns (id, owner_id, name, payload, updated_at, created_at) VALUES (?, ?, ?, ?, ?, ?)",
  ).run(
    crypto.randomUUID(),
    userId,
    String(starter.campaignName),
    JSON.stringify(starter),
    now,
    now,
  );
}

function duplicateUsername(): RegistrationResult {
  return { error: "That username is already registered.", status: 409 };
}
