import { statement } from "../../db/statements.ts";
import { sanitizeRichText } from "../security/sanitize-rich-text.ts";
import type { DatabaseSync } from "node:sqlite";
import { runTransaction } from "../../db/transaction.ts";
import {
  requireCampaignEdit,
  requireCampaignRead,
} from "../campaigns/access.ts";
import { ResourceNotFoundError } from "../http/conflicts.ts";
import { syncScreenshotReferences } from "../media/screenshots.ts";
import type { StoryBeat } from "../../domain/types.ts";
import {
  index,
  removeIndex,
  assertUpdated,
  changed,
  withTimestamps,
} from "./persistence.ts";
type StoryRow = Omit<StoryBeat, "sessionIds" | "createdAt" | "updatedAt"> & {
  createdAt: number;
  updatedAt: number;
};
export function createStoryRepository(database: DatabaseSync) {
  return {
    listStory(campaignId: string, actorUserId: string): StoryBeat[] {
      requireCampaignRead(database, campaignId, actorUserId);
      const rows = statement(
        database,
        `SELECT id, campaign_id AS campaignId, title, chapter, details, status,
                sort_order AS sortOrder, revision,
                created_at AS createdAt, updated_at AS updatedAt
           FROM story_beats WHERE campaign_id = ?
          ORDER BY sort_order, id`,
      ).all(campaignId) as StoryRow[];
      const sessions = statement(
        database,
        "SELECT session_id AS sessionId FROM story_session_links WHERE story_beat_id = ? ORDER BY session_id",
      );
      return rows.map((row) => ({
        ...toStory(row),
        sessionIds: (sessions.all(row.id) as Array<{ sessionId: string }>).map(
          ({ sessionId }) => sessionId,
        ),
      }));
    },
    createStoryBeat(
      campaignId: string,
      actorUserId: string,
      input: Pick<
        StoryBeat,
        "title" | "chapter" | "details" | "status" | "sortOrder" | "sessionIds"
      >,
    ): StoryBeat {
      requireCampaignEdit(database, campaignId, actorUserId);
      const id = crypto.randomUUID();
      const now = Date.now();
      runTransaction(database, () => {
        statement(
          database,
          `INSERT INTO story_beats
            (id, campaign_id, title, chapter, details, status, sort_order,
             revision, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
        ).run(
          id,
          campaignId,
          input.title,
          input.chapter,
          sanitizeRichText(input.details ?? ""),
          input.status,
          input.sortOrder,
          now,
          now,
        );
        replaceStoryLinks(database, campaignId, id, input.sessionIds);
        changed(database, campaignId, actorUserId, "story_beat", id, "created");
        index(
          database,
          campaignId,
          "story",
          id,
          input.title,
          `${input.chapter} ${input.details}`,
        );
        syncScreenshotReferences(
          database,
          campaignId,
          actorUserId,
          "story_beat",
          id,
          sanitizeRichText(input.details ?? ""),
        );
      });
      return getStory(database, id);
    },
    updateStoryBeat(
      campaignId: string,
      actorUserId: string,
      id: string,
      expectedRevision: number,
      input: Pick<
        StoryBeat,
        "title" | "chapter" | "details" | "status" | "sortOrder" | "sessionIds"
      >,
    ): StoryBeat {
      requireCampaignEdit(database, campaignId, actorUserId);
      runTransaction(database, () => {
        const result = statement(
          database,
          `UPDATE story_beats SET title = ?, chapter = ?, details = ?, status = ?,
             sort_order = ?, revision = revision + 1, updated_at = ?
           WHERE id = ? AND campaign_id = ? AND revision = ?`,
        ).run(
          input.title,
          input.chapter,
          sanitizeRichText(input.details ?? ""),
          input.status,
          input.sortOrder,
          Date.now(),
          id,
          campaignId,
          expectedRevision,
        );
        assertUpdated(
          database,
          "story_beats",
          "story beat",
          id,
          expectedRevision,
          result.changes,
        );
        replaceStoryLinks(database, campaignId, id, input.sessionIds);
        changed(database, campaignId, actorUserId, "story_beat", id, "updated");
        index(
          database,
          campaignId,
          "story",
          id,
          input.title,
          `${input.chapter} ${input.details}`,
        );
        syncScreenshotReferences(
          database,
          campaignId,
          actorUserId,
          "story_beat",
          id,
          sanitizeRichText(input.details ?? ""),
        );
      });
      return getStory(database, id);
    },
    deleteStoryBeat(campaignId: string, actorUserId: string, id: string): void {
      requireCampaignEdit(database, campaignId, actorUserId);
      runTransaction(database, () => {
        syncScreenshotReferences(
          database,
          campaignId,
          actorUserId,
          "story_beat",
          id,
          "",
        );
        const result = statement(
          database,
          "DELETE FROM story_beats WHERE id = ? AND campaign_id = ?",
        ).run(id, campaignId);
        if (!result.changes) throw new ResourceNotFoundError("story beat", id);
        removeIndex(database, campaignId, "story", id);
        changed(database, campaignId, actorUserId, "story_beat", id, "deleted");
      });
    },
  };
}
function replaceStoryLinks(
  database: DatabaseSync,
  campaignId: string,
  storyBeatId: string,
  sessionIds: string[],
): void {
  statement(
    database,
    "DELETE FROM story_session_links WHERE story_beat_id = ?",
  ).run(storyBeatId);
  const uniqueIds = [...new Set(sessionIds)];
  const valid = statement(
    database,
    "SELECT id FROM sessions WHERE id = ? AND campaign_id = ? LIMIT 1",
  );
  const insert = statement(
    database,
    "INSERT INTO story_session_links (story_beat_id, session_id) VALUES (?, ?)",
  );
  for (const sessionId of uniqueIds) {
    if (!valid.get(sessionId, campaignId))
      throw new ResourceNotFoundError("session", sessionId);
    insert.run(storyBeatId, sessionId);
  }
}

function getStory(database: DatabaseSync, id: string): StoryBeat {
  const row = statement(
    database,
    `SELECT id, campaign_id AS campaignId, title, chapter, details, status,
            sort_order AS sortOrder, revision,
            created_at AS createdAt, updated_at AS updatedAt
       FROM story_beats WHERE id = ?`,
  ).get(id) as StoryRow | undefined;
  if (!row) throw new ResourceNotFoundError("story beat", id);
  const sessionIds = (
    statement(
      database,
      "SELECT session_id AS sessionId FROM story_session_links WHERE story_beat_id = ? ORDER BY session_id",
    ).all(id) as Array<{ sessionId: string }>
  ).map(({ sessionId }) => sessionId);
  return { ...toStory(row), sessionIds };
}

function toStory(row: StoryRow): Omit<StoryBeat, "sessionIds"> {
  return withTimestamps(row);
}
