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
  const localAccounts = db
    .prepare("SELECT COUNT(*) AS count FROM users WHERE password_hash IS NOT NULL")
    .get() as { count: number };
  const existingUsers = db
    .prepare("SELECT COUNT(*) AS count FROM users")
    .get() as { count: number };
  const legacyUser =
    localAccounts.count === 0 && existingUsers.count === 1
      ? (db.prepare("SELECT id FROM users LIMIT 1").get() as
          | { id: string }
          | undefined)
      : undefined;
  const id = legacyUser?.id ?? crypto.randomUUID();
  const isAdmin = localAccounts.count === 0;

  try {
    if (legacyUser) {
      db.prepare(
        "UPDATE users SET display_name = ?, username = ?, password_hash = ?, is_admin = 1, updated_at = ? WHERE id = ?",
      ).run(displayName, username, passwordHash, now, id);
    } else {
      db.prepare(
        "INSERT INTO users (id, email, display_name, username, password_hash, is_admin, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      ).run(
        id,
        `${username}@local.dm-command-table`,
        displayName,
        username,
        passwordHash,
        isAdmin ? 1 : 0,
        now,
      );
    }
  } catch {
    return duplicateUsername();
  }

  db.prepare(
    "UPDATE campaign_members SET user_id = ? WHERE user_id IS NULL AND invite_email = ?",
  ).run(id, username);
  createInitialCampaignIfNeeded(id, Boolean(legacyUser), now);
  return { user: { userId: id, username, displayName, isAdmin } };
}

function createInitialCampaignIfNeeded(
  userId: string,
  legacyUser: boolean,
  now: number,
): void {
  const db = getDatabase();
  const ownedCampaigns = db
    .prepare("SELECT COUNT(*) AS count FROM campaigns WHERE owner_id = ?")
    .get(userId) as { count: number };
  const legacyState = legacyUser
    ? db
        .prepare("SELECT id FROM campaign_states WHERE id = 'main-campaign' LIMIT 1")
        .get()
    : undefined;
  if (ownedCampaigns.count !== 0 || legacyState) return;
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
