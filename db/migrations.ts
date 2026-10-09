import type { DatabaseSync } from "node:sqlite";

export type Migration = {
  version: number;
  name: string;
  sql: string;
};

export const migrations: readonly Migration[] = [
  {
    version: 1,
    name: "local-first-baseline",
    sql: `
      CREATE TABLE security_rate_limits (
        key TEXT PRIMARY KEY NOT NULL,
        count INTEGER NOT NULL CHECK (count > 0),
        resets_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX idx_security_rate_limits_resets_at ON security_rate_limits(resets_at);
      CREATE TABLE prepared_combatants (
        id TEXT PRIMARY KEY NOT NULL,
        encounter_id TEXT NOT NULL REFERENCES prepared_encounters(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        kind TEXT NOT NULL CHECK (kind IN ('player','npc','monster')),
        notes TEXT NOT NULL DEFAULT '',
        display_number INTEGER,
        initiative REAL NOT NULL,
        hit_points REAL NOT NULL,
        maximum_hit_points REAL NOT NULL CHECK (maximum_hit_points >= 0),
        armor_class REAL NOT NULL CHECK (armor_class >= 0),
        sort_order INTEGER NOT NULL
      );
      CREATE INDEX idx_prepared_combatants_encounter ON prepared_combatants(encounter_id);
      CREATE TABLE users (
        id TEXT PRIMARY KEY NOT NULL,
        display_name TEXT NOT NULL,
        username TEXT NOT NULL COLLATE NOCASE,
        password_hash TEXT NOT NULL,
        is_admin INTEGER NOT NULL DEFAULT 0 CHECK (is_admin IN (0, 1)),
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE UNIQUE INDEX idx_users_username ON users (username);

      CREATE TABLE local_sessions (
        token_hash TEXT PRIMARY KEY NOT NULL,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX idx_local_sessions_user_id ON local_sessions (user_id);
      CREATE INDEX idx_local_sessions_expires_at ON local_sessions (expires_at);

      CREATE TABLE application_settings (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE campaigns (
        id TEXT PRIMARY KEY NOT NULL,
        owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        notes TEXT NOT NULL DEFAULT '',
        archived INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0, 1)),
        revision INTEGER NOT NULL DEFAULT 1,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX idx_campaigns_owner_id ON campaigns (owner_id);
      CREATE INDEX idx_campaigns_updated_at ON campaigns (updated_at DESC);

      CREATE TABLE campaign_members (
        campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role TEXT NOT NULL CHECK (role IN ('viewer', 'editor')),
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (campaign_id, user_id)
      );
      CREATE INDEX idx_campaign_members_user_id ON campaign_members (user_id);

      CREATE TABLE players (
        id TEXT PRIMARY KEY NOT NULL,
        campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        kind TEXT NOT NULL CHECK (kind IN ('player', 'npc')),
        race TEXT NOT NULL DEFAULT '',
        class_name TEXT NOT NULL DEFAULT '',
        level INTEGER,
        hit_points INTEGER,
        armor_class INTEGER,
        notes TEXT NOT NULL DEFAULT '',
        revision INTEGER NOT NULL DEFAULT 1,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX idx_players_campaign_id ON players (campaign_id);
      CREATE INDEX idx_players_name ON players (campaign_id, name COLLATE NOCASE);

      CREATE TABLE monsters (
        id TEXT PRIMARY KEY NOT NULL,
        campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT '',
        challenge_rating TEXT NOT NULL DEFAULT '',
        armor_class INTEGER NOT NULL DEFAULT 10,
        hit_points INTEGER NOT NULL DEFAULT 1,
        speed TEXT NOT NULL DEFAULT '',
        stats TEXT NOT NULL DEFAULT '',
        abilities TEXT NOT NULL DEFAULT '',
        spells TEXT NOT NULL DEFAULT '',
        notes TEXT NOT NULL DEFAULT '',
        spell_slots TEXT NOT NULL DEFAULT '[]',
        source TEXT,
        favorite INTEGER NOT NULL DEFAULT 0 CHECK (favorite IN (0, 1)),
        revision INTEGER NOT NULL DEFAULT 1,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX idx_monsters_campaign_id ON monsters (campaign_id);
      CREATE INDEX idx_monsters_name ON monsters (campaign_id, name COLLATE NOCASE);

      CREATE TABLE tags (
        id TEXT PRIMARY KEY NOT NULL,
        campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
        name TEXT NOT NULL COLLATE NOCASE,
        color TEXT,
        UNIQUE (campaign_id, name)
      );
      CREATE TABLE monster_tags (
        monster_id TEXT NOT NULL REFERENCES monsters(id) ON DELETE CASCADE,
        tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
        PRIMARY KEY (monster_id, tag_id)
      );

      CREATE TABLE sessions (
        id TEXT PRIMARY KEY NOT NULL,
        campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        session_date TEXT NOT NULL DEFAULT '',
        notes TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'active', 'happened')),
        sort_order INTEGER NOT NULL DEFAULT 0,
        revision INTEGER NOT NULL DEFAULT 1,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX idx_sessions_campaign_id ON sessions (campaign_id);
      CREATE INDEX idx_sessions_date ON sessions (campaign_id, session_date);

      CREATE TABLE story_beats (
        id TEXT PRIMARY KEY NOT NULL,
        campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        chapter TEXT NOT NULL DEFAULT '',
        details TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'active', 'happened')),
        sort_order INTEGER NOT NULL DEFAULT 0,
        revision INTEGER NOT NULL DEFAULT 1,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX idx_story_beats_campaign_id ON story_beats (campaign_id);

      CREATE TABLE story_session_links (
        story_beat_id TEXT NOT NULL REFERENCES story_beats(id) ON DELETE CASCADE,
        session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
        PRIMARY KEY (story_beat_id, session_id)
      );

      CREATE TABLE prepared_encounters (
        id TEXT PRIMARY KEY NOT NULL,
        session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        notes TEXT NOT NULL DEFAULT '',
        sort_order INTEGER NOT NULL DEFAULT 0,
        revision INTEGER NOT NULL DEFAULT 1,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX idx_prepared_encounters_session_id ON prepared_encounters (session_id);

      CREATE TABLE prepared_encounter_monsters (
        id TEXT PRIMARY KEY NOT NULL,
        encounter_id TEXT NOT NULL REFERENCES prepared_encounters(id) ON DELETE CASCADE,
        monster_id TEXT NOT NULL REFERENCES monsters(id) ON DELETE RESTRICT,
        display_number INTEGER,
        quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
        sort_order INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX idx_prepared_monsters_encounter_id ON prepared_encounter_monsters (encounter_id);

      CREATE TABLE combat_encounters (
        id TEXT PRIMARY KEY NOT NULL,
        campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
        name TEXT NOT NULL DEFAULT 'Encounter',
        round INTEGER NOT NULL DEFAULT 1 CHECK (round > 0),
        turn INTEGER NOT NULL DEFAULT 0 CHECK (turn >= 0),
        active_combatant_id TEXT,
        revision INTEGER NOT NULL DEFAULT 1,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE UNIQUE INDEX idx_active_combat_campaign ON combat_encounters (campaign_id);

      CREATE TABLE combatants (
        id TEXT PRIMARY KEY NOT NULL,
        encounter_id TEXT NOT NULL REFERENCES combat_encounters(id) ON DELETE CASCADE,
        player_id TEXT REFERENCES players(id) ON DELETE SET NULL,
        monster_id TEXT REFERENCES monsters(id) ON DELETE SET NULL,
        name TEXT NOT NULL,
        display_number INTEGER,
        kind TEXT NOT NULL CHECK (kind IN ('player', 'monster', 'npc')),
        notes TEXT NOT NULL DEFAULT '',
        initiative REAL NOT NULL DEFAULT 0,
        hit_points REAL NOT NULL DEFAULT 1,
        maximum_hit_points REAL NOT NULL DEFAULT 1,
        armor_class REAL NOT NULL DEFAULT 10,
        sort_order INTEGER NOT NULL DEFAULT 0,
        revision INTEGER NOT NULL DEFAULT 1,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX idx_combatants_encounter_id ON combatants (encounter_id);
      CREATE UNIQUE INDEX idx_unique_combat_player
        ON combatants (encounter_id, player_id) WHERE player_id IS NOT NULL;

      CREATE TABLE combat_conditions (
        id TEXT PRIMARY KEY NOT NULL,
        combatant_id TEXT NOT NULL REFERENCES combatants(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        remaining_turns INTEGER CHECK (remaining_turns IS NULL OR remaining_turns > 0),
        created_at INTEGER NOT NULL
      );

      CREATE TABLE combat_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        encounter_id TEXT NOT NULL REFERENCES combat_encounters(id) ON DELETE CASCADE,
        actor_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        action TEXT NOT NULL,
        before_state TEXT,
        after_state TEXT,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX idx_combat_history_encounter_id ON combat_history (encounter_id, id DESC);

      CREATE TABLE screenshots (
        id TEXT PRIMARY KEY NOT NULL,
        filename TEXT NOT NULL UNIQUE,
        original_name TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        staging INTEGER NOT NULL DEFAULT 0 CHECK (staging IN (0,1)),
        size INTEGER NOT NULL CHECK (size >= 0),
        width INTEGER,
        height INTEGER,
        uploaded_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX idx_screenshots_created_at ON screenshots (created_at DESC);

      CREATE TABLE screenshot_references (
        screenshot_id TEXT NOT NULL REFERENCES screenshots(id) ON DELETE CASCADE,
        campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
        resource_type TEXT NOT NULL,
        resource_id TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        PRIMARY KEY (screenshot_id, resource_type, resource_id)
      );
      CREATE INDEX idx_screenshot_references_campaign ON screenshot_references (campaign_id);

      CREATE TABLE session_templates (
        id TEXT PRIMARY KEY NOT NULL,
        owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE audit_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        campaign_id TEXT REFERENCES campaigns(id) ON DELETE CASCADE,
        actor_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        resource_type TEXT NOT NULL,
        resource_id TEXT,
        action TEXT NOT NULL,
        details TEXT,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX idx_audit_campaign_created ON audit_events (campaign_id, created_at DESC);
      CREATE INDEX idx_audit_actor_created ON audit_events (actor_user_id, created_at DESC);

      CREATE VIRTUAL TABLE search_index USING fts5(
        campaign_id UNINDEXED,
        resource_type UNINDEXED,
        resource_id UNINDEXED,
        title,
        content,
        tokenize = 'unicode61 remove_diacritics 2'
      );
    `,
  },
];

export function runMigrations(database: DatabaseSync): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      applied_at INTEGER NOT NULL
    );
  `);
  const current = database
    .prepare(
      "SELECT COALESCE(MAX(version), 0) AS version FROM schema_migrations",
    )
    .get() as { version: number };

  for (const migration of migrations) {
    if (migration.version <= current.version) continue;
    database.exec("BEGIN IMMEDIATE");
    try {
      database.exec(migration.sql);
      database
        .prepare(
          "INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)",
        )
        .run(migration.version, migration.name, Date.now());
      database.exec("COMMIT");
    } catch (error) {
      database.exec("ROLLBACK");
      throw error;
    }
  }
}
