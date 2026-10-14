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
import type { Session } from "../../domain/types.ts";
import {
  index,
  removeIndex,
  assertUpdated,
  changed,
  withTimestamps,
} from "./persistence.ts";
type SessionRow = Omit<Session, "createdAt" | "updatedAt"> & {
  createdAt: number;
  updatedAt: number;
};
export function createSessionRepository(database: DatabaseSync) {
  return {
    listSessions(campaignId: string, actorUserId: string): Session[] {
      requireCampaignRead(database, campaignId, actorUserId);
      return (
        statement(
          database,
          `SELECT id, campaign_id AS campaignId, title, session_date AS date, notes,
                status, sort_order AS sortOrder, revision,
                created_at AS createdAt, updated_at AS updatedAt
           FROM sessions WHERE campaign_id = ?
          ORDER BY session_date DESC, sort_order, id`,
        ).all(campaignId) as SessionRow[]
      ).map(toSession);
    },
    createSession(
      campaignId: string,
      actorUserId: string,
      input: Pick<Session, "title" | "date" | "notes" | "status" | "sortOrder">,
    ): Session {
      requireCampaignEdit(database, campaignId, actorUserId);
      const id = crypto.randomUUID();
      const now = Date.now();
      runTransaction(database, () => {
        statement(
          database,
          `INSERT INTO sessions
          (id, campaign_id, title, session_date, notes, status, sort_order,
           revision, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
        ).run(
          id,
          campaignId,
          input.title,
          input.date,
          sanitizeRichText(input.notes ?? ""),
          input.status,
          input.sortOrder,
          now,
          now,
        );
        changed(database, campaignId, actorUserId, "session", id, "created");
        index(
          database,
          campaignId,
          "session",
          id,
          input.title,
          `${input.date} ${input.notes}`,
        );
        syncScreenshotReferences(
          database,
          campaignId,
          actorUserId,
          "session",
          id,
          sanitizeRichText(input.notes ?? ""),
        );
      });
      return getSession(database, id);
    },
    updateSession(
      campaignId: string,
      actorUserId: string,
      id: string,
      expectedRevision: number,
      input: Pick<Session, "title" | "date" | "notes" | "status" | "sortOrder">,
    ): Session {
      requireCampaignEdit(database, campaignId, actorUserId);
      runTransaction(database, () => {
        const result = statement(
          database,
          `UPDATE sessions SET title = ?, session_date = ?, notes = ?, status = ?,
           sort_order = ?, revision = revision + 1, updated_at = ?
         WHERE id = ? AND campaign_id = ? AND revision = ?`,
        ).run(
          input.title,
          input.date,
          sanitizeRichText(input.notes ?? ""),
          input.status,
          input.sortOrder,
          Date.now(),
          id,
          campaignId,
          expectedRevision,
        );
        assertUpdated(
          database,
          "sessions",
          "session",
          id,
          expectedRevision,
          result.changes,
          campaignId,
        );
        changed(database, campaignId, actorUserId, "session", id, "updated");
        index(
          database,
          campaignId,
          "session",
          id,
          input.title,
          `${input.date} ${input.notes}`,
        );
        syncScreenshotReferences(
          database,
          campaignId,
          actorUserId,
          "session",
          id,
          sanitizeRichText(input.notes ?? ""),
        );
      });
      return getSession(database, id);
    },
    deleteSession(campaignId: string, actorUserId: string, id: string): void {
      requireCampaignEdit(database, campaignId, actorUserId);
      runTransaction(database, () => {
        syncScreenshotReferences(
          database,
          campaignId,
          actorUserId,
          "session",
          id,
          "",
        );
        statement(
          database,
          `DELETE FROM screenshot_references
            WHERE campaign_id = ? AND resource_type = 'prepared_encounter'
              AND resource_id IN (SELECT id FROM prepared_encounters WHERE session_id = ?)`,
        ).run(campaignId, id);
        const result = statement(
          database,
          "DELETE FROM sessions WHERE id = ? AND campaign_id = ?",
        ).run(id, campaignId);
        if (!result.changes) throw new ResourceNotFoundError("session", id);
        removeIndex(database, campaignId, "session", id);
        changed(database, campaignId, actorUserId, "session", id, "deleted");
      });
    },
  };
}
function getSession(database: DatabaseSync, id: string): Session {
  const row = statement(
    database,
    `SELECT id, campaign_id AS campaignId, title, session_date AS date, notes,
            status, sort_order AS sortOrder, revision,
            created_at AS createdAt, updated_at AS updatedAt
       FROM sessions WHERE id = ?`,
  ).get(id) as SessionRow | undefined;
  if (!row) throw new ResourceNotFoundError("session", id);
  return toSession(row);
}

function toSession(row: SessionRow): Session {
  return withTimestamps(row);
}
