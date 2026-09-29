import type { DatabaseSync } from "node:sqlite";
import { runTransaction } from "../../db/transaction.ts";
import { requireCampaignEdit, requireCampaignRead } from "./access.ts";
import { recordAuditEvent } from "./audit.ts";
import { ResourceNotFoundError, RevisionConflictError } from "./conflicts.ts";

export type ProgressStatus = "planned" | "active" | "happened";

export type V6Player = {
  id: string;
  campaignId: string;
  name: string;
  race: string;
  className: string;
  level: number | null;
  hitPoints: number | null;
  armorClass: number | null;
  notes: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
};

export type V6Session = {
  id: string;
  campaignId: string;
  title: string;
  date: string;
  notes: string;
  status: ProgressStatus;
  sortOrder: number;
  revision: number;
  createdAt: string;
  updatedAt: string;
};

export type V6StoryBeat = {
  id: string;
  campaignId: string;
  title: string;
  chapter: string;
  details: string;
  status: ProgressStatus;
  sortOrder: number;
  sessionIds: string[];
  revision: number;
  createdAt: string;
  updatedAt: string;
};

type PlayerRow = Omit<V6Player, "createdAt" | "updatedAt"> & {
  createdAt: number;
  updatedAt: number;
};
type SessionRow = Omit<V6Session, "createdAt" | "updatedAt"> & {
  createdAt: number;
  updatedAt: number;
};
type StoryRow = Omit<V6StoryBeat, "sessionIds" | "createdAt" | "updatedAt"> & {
  createdAt: number;
  updatedAt: number;
};

export function createContentRepository(database: DatabaseSync) {
  return {
    listPlayers(campaignId: string, actorUserId: string): V6Player[] {
      requireCampaignRead(database, campaignId, actorUserId);
      return (database.prepare(
        `SELECT id, campaign_id AS campaignId, name, race, class_name AS className,
                level, hit_points AS hitPoints, armor_class AS armorClass, notes,
                revision, created_at AS createdAt, updated_at AS updatedAt
           FROM players WHERE campaign_id = ? ORDER BY name COLLATE NOCASE, id`,
      ).all(campaignId) as PlayerRow[]).map(toPlayer);
    },

    createPlayer(
      campaignId: string,
      actorUserId: string,
      input: Omit<V6Player, "id" | "campaignId" | "revision" | "createdAt" | "updatedAt">,
    ): V6Player {
      requireCampaignEdit(database, campaignId, actorUserId);
      const id = crypto.randomUUID();
      const now = Date.now();
      database.prepare(
        `INSERT INTO players
          (id, campaign_id, name, race, class_name, level, hit_points,
           armor_class, notes, revision, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      ).run(
        id, campaignId, input.name, input.race, input.className, input.level,
        input.hitPoints, input.armorClass, input.notes, now, now,
      );
      changed(database, campaignId, actorUserId, "player", id, "created");
      index(database, campaignId, "player", id, input.name, `${input.race} ${input.className} ${input.notes}`);
      return getPlayer(database, id);
    },

    updatePlayer(
      campaignId: string,
      actorUserId: string,
      id: string,
      expectedRevision: number,
      input: Omit<V6Player, "id" | "campaignId" | "revision" | "createdAt" | "updatedAt">,
    ): V6Player {
      requireCampaignEdit(database, campaignId, actorUserId);
      const result = database.prepare(
        `UPDATE players SET name = ?, race = ?, class_name = ?, level = ?,
           hit_points = ?, armor_class = ?, notes = ?, revision = revision + 1,
           updated_at = ?
         WHERE id = ? AND campaign_id = ? AND revision = ?`,
      ).run(
        input.name, input.race, input.className, input.level, input.hitPoints,
        input.armorClass, input.notes, Date.now(), id, campaignId, expectedRevision,
      );
      assertUpdated(database, "players", "player", id, expectedRevision, result.changes);
      changed(database, campaignId, actorUserId, "player", id, "updated");
      index(database, campaignId, "player", id, input.name, `${input.race} ${input.className} ${input.notes}`);
      return getPlayer(database, id);
    },

    deletePlayer(campaignId: string, actorUserId: string, id: string): void {
      requireCampaignEdit(database, campaignId, actorUserId);
      const result = database.prepare(
        "DELETE FROM players WHERE id = ? AND campaign_id = ?",
      ).run(id, campaignId);
      if (!result.changes) throw new ResourceNotFoundError("player", id);
      removeIndex(database, campaignId, "player", id);
      changed(database, campaignId, actorUserId, "player", id, "deleted");
    },

    listSessions(campaignId: string, actorUserId: string): V6Session[] {
      requireCampaignRead(database, campaignId, actorUserId);
      return (database.prepare(
        `SELECT id, campaign_id AS campaignId, title, session_date AS date, notes,
                status, sort_order AS sortOrder, revision,
                created_at AS createdAt, updated_at AS updatedAt
           FROM sessions WHERE campaign_id = ?
          ORDER BY session_date DESC, sort_order, id`,
      ).all(campaignId) as SessionRow[]).map(toSession);
    },

    createSession(
      campaignId: string,
      actorUserId: string,
      input: Pick<V6Session, "title" | "date" | "notes" | "status" | "sortOrder">,
    ): V6Session {
      requireCampaignEdit(database, campaignId, actorUserId);
      const id = crypto.randomUUID();
      const now = Date.now();
      database.prepare(
        `INSERT INTO sessions
          (id, campaign_id, title, session_date, notes, status, sort_order,
           revision, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      ).run(
        id, campaignId, input.title, input.date, input.notes, input.status,
        input.sortOrder, now, now,
      );
      changed(database, campaignId, actorUserId, "session", id, "created");
      index(database, campaignId, "session", id, input.title, `${input.date} ${input.notes}`);
      return getSession(database, id);
    },

    updateSession(
      campaignId: string,
      actorUserId: string,
      id: string,
      expectedRevision: number,
      input: Pick<V6Session, "title" | "date" | "notes" | "status" | "sortOrder">,
    ): V6Session {
      requireCampaignEdit(database, campaignId, actorUserId);
      const result = database.prepare(
        `UPDATE sessions SET title = ?, session_date = ?, notes = ?, status = ?,
           sort_order = ?, revision = revision + 1, updated_at = ?
         WHERE id = ? AND campaign_id = ? AND revision = ?`,
      ).run(
        input.title, input.date, input.notes, input.status, input.sortOrder,
        Date.now(), id, campaignId, expectedRevision,
      );
      assertUpdated(database, "sessions", "session", id, expectedRevision, result.changes);
      changed(database, campaignId, actorUserId, "session", id, "updated");
      index(database, campaignId, "session", id, input.title, `${input.date} ${input.notes}`);
      return getSession(database, id);
    },

    deleteSession(campaignId: string, actorUserId: string, id: string): void {
      requireCampaignEdit(database, campaignId, actorUserId);
      const result = database.prepare(
        "DELETE FROM sessions WHERE id = ? AND campaign_id = ?",
      ).run(id, campaignId);
      if (!result.changes) throw new ResourceNotFoundError("session", id);
      removeIndex(database, campaignId, "session", id);
      changed(database, campaignId, actorUserId, "session", id, "deleted");
    },

    listStory(campaignId: string, actorUserId: string): V6StoryBeat[] {
      requireCampaignRead(database, campaignId, actorUserId);
      const rows = database.prepare(
        `SELECT id, campaign_id AS campaignId, title, chapter, details, status,
                sort_order AS sortOrder, revision,
                created_at AS createdAt, updated_at AS updatedAt
           FROM story_beats WHERE campaign_id = ?
          ORDER BY sort_order, id`,
      ).all(campaignId) as StoryRow[];
      const sessions = database.prepare(
        "SELECT session_id AS sessionId FROM story_session_links WHERE story_beat_id = ? ORDER BY session_id",
      );
      return rows.map((row) => ({
        ...toStory(row),
        sessionIds: (sessions.all(row.id) as Array<{ sessionId: string }>).map(({ sessionId }) => sessionId),
      }));
    },

    createStoryBeat(
      campaignId: string,
      actorUserId: string,
      input: Pick<V6StoryBeat, "title" | "chapter" | "details" | "status" | "sortOrder" | "sessionIds">,
    ): V6StoryBeat {
      requireCampaignEdit(database, campaignId, actorUserId);
      const id = crypto.randomUUID();
      const now = Date.now();
      runTransaction(database, () => {
        database.prepare(
          `INSERT INTO story_beats
            (id, campaign_id, title, chapter, details, status, sort_order,
             revision, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
        ).run(
          id, campaignId, input.title, input.chapter, input.details, input.status,
          input.sortOrder, now, now,
        );
        replaceStoryLinks(database, campaignId, id, input.sessionIds);
        changed(database, campaignId, actorUserId, "story_beat", id, "created");
      });
      index(database, campaignId, "story", id, input.title, `${input.chapter} ${input.details}`);
      return getStory(database, id);
    },

    updateStoryBeat(
      campaignId: string,
      actorUserId: string,
      id: string,
      expectedRevision: number,
      input: Pick<V6StoryBeat, "title" | "chapter" | "details" | "status" | "sortOrder" | "sessionIds">,
    ): V6StoryBeat {
      requireCampaignEdit(database, campaignId, actorUserId);
      runTransaction(database, () => {
        const result = database.prepare(
          `UPDATE story_beats SET title = ?, chapter = ?, details = ?, status = ?,
             sort_order = ?, revision = revision + 1, updated_at = ?
           WHERE id = ? AND campaign_id = ? AND revision = ?`,
        ).run(
          input.title, input.chapter, input.details, input.status, input.sortOrder,
          Date.now(), id, campaignId, expectedRevision,
        );
        assertUpdated(database, "story_beats", "story beat", id, expectedRevision, result.changes);
        replaceStoryLinks(database, campaignId, id, input.sessionIds);
        changed(database, campaignId, actorUserId, "story_beat", id, "updated");
      });
      index(database, campaignId, "story", id, input.title, `${input.chapter} ${input.details}`);
      return getStory(database, id);
    },

    deleteStoryBeat(campaignId: string, actorUserId: string, id: string): void {
      requireCampaignEdit(database, campaignId, actorUserId);
      const result = database.prepare(
        "DELETE FROM story_beats WHERE id = ? AND campaign_id = ?",
      ).run(id, campaignId);
      if (!result.changes) throw new ResourceNotFoundError("story beat", id);
      removeIndex(database, campaignId, "story", id);
      changed(database, campaignId, actorUserId, "story_beat", id, "deleted");
    },
  };
}

function index(database: DatabaseSync, campaignId: string, type: string, id: string, title: string, content: string) { database.prepare("DELETE FROM search_index WHERE campaign_id=? AND resource_type=? AND resource_id=?").run(campaignId,type,id); database.prepare("INSERT INTO search_index (campaign_id,resource_type,resource_id,title,content) VALUES (?,?,?,?,?)").run(campaignId,type,id,title,content); }
function removeIndex(database: DatabaseSync, campaignId: string, type: string, id: string) { database.prepare("DELETE FROM search_index WHERE campaign_id=? AND resource_type=? AND resource_id=?").run(campaignId,type,id); }

function replaceStoryLinks(
  database: DatabaseSync,
  campaignId: string,
  storyBeatId: string,
  sessionIds: string[],
): void {
  database.prepare("DELETE FROM story_session_links WHERE story_beat_id = ?").run(storyBeatId);
  const uniqueIds = [...new Set(sessionIds)];
  const valid = database.prepare(
    "SELECT id FROM sessions WHERE id = ? AND campaign_id = ? LIMIT 1",
  );
  const insert = database.prepare(
    "INSERT INTO story_session_links (story_beat_id, session_id) VALUES (?, ?)",
  );
  for (const sessionId of uniqueIds) {
    if (!valid.get(sessionId, campaignId))
      throw new ResourceNotFoundError("session", sessionId);
    insert.run(storyBeatId, sessionId);
  }
}

function assertUpdated(
  database: DatabaseSync,
  table: "players" | "sessions" | "story_beats",
  resourceType: string,
  id: string,
  expectedRevision: number,
  changes: number | bigint,
): void {
  if (Number(changes) !== 0) return;
  const actual = database.prepare(`SELECT revision FROM ${table} WHERE id = ?`).get(id) as
    | { revision: number }
    | undefined;
  if (!actual) throw new ResourceNotFoundError(resourceType, id);
  throw new RevisionConflictError(resourceType, id, expectedRevision, actual.revision);
}

function changed(
  database: DatabaseSync,
  campaignId: string,
  actorUserId: string,
  resourceType: string,
  resourceId: string,
  action: string,
): void {
  database.prepare(
    "UPDATE campaigns SET revision = revision + 1, updated_at = ? WHERE id = ?",
  ).run(Date.now(), campaignId);
  recordAuditEvent(database, {
    campaignId,
    actorUserId,
    resourceType,
    resourceId,
    action,
  });
}

function getPlayer(database: DatabaseSync, id: string): V6Player {
  const row = database.prepare(
    `SELECT id, campaign_id AS campaignId, name, race, class_name AS className,
            level, hit_points AS hitPoints, armor_class AS armorClass, notes,
            revision, created_at AS createdAt, updated_at AS updatedAt
       FROM players WHERE id = ?`,
  ).get(id) as PlayerRow | undefined;
  if (!row) throw new ResourceNotFoundError("player", id);
  return toPlayer(row);
}

function getSession(database: DatabaseSync, id: string): V6Session {
  const row = database.prepare(
    `SELECT id, campaign_id AS campaignId, title, session_date AS date, notes,
            status, sort_order AS sortOrder, revision,
            created_at AS createdAt, updated_at AS updatedAt
       FROM sessions WHERE id = ?`,
  ).get(id) as SessionRow | undefined;
  if (!row) throw new ResourceNotFoundError("session", id);
  return toSession(row);
}

function getStory(database: DatabaseSync, id: string): V6StoryBeat {
  const row = database.prepare(
    `SELECT id, campaign_id AS campaignId, title, chapter, details, status,
            sort_order AS sortOrder, revision,
            created_at AS createdAt, updated_at AS updatedAt
       FROM story_beats WHERE id = ?`,
  ).get(id) as StoryRow | undefined;
  if (!row) throw new ResourceNotFoundError("story beat", id);
  const sessionIds = (database.prepare(
    "SELECT session_id AS sessionId FROM story_session_links WHERE story_beat_id = ? ORDER BY session_id",
  ).all(id) as Array<{ sessionId: string }>).map(({ sessionId }) => sessionId);
  return { ...toStory(row), sessionIds };
}

function toPlayer(row: PlayerRow): V6Player {
  return { ...row, createdAt: iso(row.createdAt), updatedAt: iso(row.updatedAt) };
}
function toSession(row: SessionRow): V6Session {
  return { ...row, createdAt: iso(row.createdAt), updatedAt: iso(row.updatedAt) };
}
function toStory(row: StoryRow): Omit<V6StoryBeat, "sessionIds"> {
  return { ...row, createdAt: iso(row.createdAt), updatedAt: iso(row.updatedAt) };
}
function iso(value: number): string {
  return new Date(value).toISOString();
}
