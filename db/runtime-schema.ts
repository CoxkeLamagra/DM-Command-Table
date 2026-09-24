import type { DatabaseSync } from "node:sqlite";

/**
 * Runtime schema bootstrap for local installations. Drizzle declarations in
 * db/schema.ts mirror these tables for schema generation and tooling.
 */
export const RUNTIME_SCHEMA = `
  CREATE TABLE IF NOT EXISTS campaign_states (
    id TEXT PRIMARY KEY NOT NULL,
    payload TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY NOT NULL,
    email TEXT NOT NULL,
    display_name TEXT NOT NULL,
    username TEXT,
    password_hash TEXT,
    is_admin INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL
  );

  CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users (email);

  CREATE TABLE IF NOT EXISTS campaigns (
    id TEXT PRIMARY KEY NOT NULL,
    owner_id TEXT NOT NULL,
    name TEXT NOT NULL,
    payload TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_campaigns_owner_id ON campaigns (owner_id);

  CREATE TABLE IF NOT EXISTS campaign_members (
    campaign_id TEXT NOT NULL,
    user_id TEXT,
    invite_email TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('viewer', 'editor')),
    added_at INTEGER NOT NULL,
    PRIMARY KEY (campaign_id, invite_email),
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_campaign_members_user_id ON campaign_members (user_id);
  CREATE INDEX IF NOT EXISTS idx_campaign_members_invite_email ON campaign_members (invite_email);

  CREATE TABLE IF NOT EXISTS local_sessions (
    token_hash TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_local_sessions_user_id ON local_sessions (user_id);
  CREATE INDEX IF NOT EXISTS idx_local_sessions_expires_at ON local_sessions (expires_at);

  CREATE TABLE IF NOT EXISTS screenshots (
    id TEXT PRIMARY KEY NOT NULL,
    filename TEXT NOT NULL,
    original_name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size INTEGER NOT NULL,
    uploaded_by TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_screenshots_created_at ON screenshots (created_at);
`;

export function applyRuntimeMigrations(database: DatabaseSync): void {
  const columns = database.prepare("PRAGMA table_info(users)").all() as Array<{
    name: string;
  }>;
  const names = new Set(columns.map((column) => column.name));
  if (!names.has("username"))
    database.exec("ALTER TABLE users ADD COLUMN username TEXT");
  if (!names.has("password_hash")) {
    database.exec("ALTER TABLE users ADD COLUMN password_hash TEXT");
  }
  if (!names.has("is_admin")) {
    database.exec(
      "ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0",
    );
  }
  database.exec(
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users (username)",
  );
  const admins = database
    .prepare(
      "SELECT COUNT(*) AS count FROM users WHERE password_hash IS NOT NULL AND is_admin = 1",
    )
    .get() as { count: number };
  if (admins.count === 0) {
    database.exec(`
      UPDATE users SET is_admin = 1
      WHERE id = (
        SELECT id FROM users
        WHERE password_hash IS NOT NULL
        ORDER BY updated_at ASC, rowid ASC
        LIMIT 1
      )
    `);
  }
}
