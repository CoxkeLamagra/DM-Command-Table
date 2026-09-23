import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const DEFAULT_DATABASE_PATH = path.join(process.cwd(), "data", "dm-command-table.sqlite");

let database: DatabaseSync | undefined;

export function getDatabase(): DatabaseSync {
  if (database) return database;

  const databasePath = path.resolve(/* turbopackIgnore: true */
    process.env.DM_COMMAND_TABLE_DB_PATH || DEFAULT_DATABASE_PATH,
  );
  mkdirSync(path.dirname(databasePath), { recursive: true });

  database = new DatabaseSync(databasePath);
  database.exec("PRAGMA journal_mode = WAL");
  database.exec("PRAGMA foreign_keys = ON");
  database.exec("PRAGMA busy_timeout = 5000");
  database.exec(SCHEMA);

  return database;
}

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS campaign_states (
    id TEXT PRIMARY KEY NOT NULL,
    payload TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY NOT NULL,
    email TEXT NOT NULL,
    display_name TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email
    ON users (email);

  CREATE TABLE IF NOT EXISTS campaigns (
    id TEXT PRIMARY KEY NOT NULL,
    owner_id TEXT NOT NULL,
    name TEXT NOT NULL,
    payload TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_campaigns_owner_id
    ON campaigns (owner_id);

  CREATE TABLE IF NOT EXISTS campaign_members (
    campaign_id TEXT NOT NULL,
    user_id TEXT,
    invite_email TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('viewer', 'editor')),
    added_at INTEGER NOT NULL,
    PRIMARY KEY (campaign_id, invite_email),
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_campaign_members_user_id
    ON campaign_members (user_id);

  CREATE INDEX IF NOT EXISTS idx_campaign_members_invite_email
    ON campaign_members (invite_email);
`;
