import { sanitizeRichText } from "../security/sanitize-rich-text.ts";
import type { DatabaseSync } from "node:sqlite";
import {
  requireCampaignEdit,
  requireCampaignRead,
} from "../campaigns/access.ts";
import { recordAuditEvent } from "./audit.ts";
import { ResourceNotFoundError } from "../http/conflicts.ts";

export type SessionTemplate = {
  id: string;
  ownerId: string;
  name: string;
  content: string;
  createdAt: string;
  updatedAt: string;
};

export type CampaignSearchResult = {
  resourceType: string;
  resourceId: string;
  title: string;
  excerpt: string;
  rank: number;
};

type TemplateRow = Omit<SessionTemplate, "createdAt" | "updatedAt"> & {
  createdAt: number;
  updatedAt: number;
};

export function createSupportRepository(database: DatabaseSync) {
  return {
    listTemplates(ownerId: string): SessionTemplate[] {
      return (
        database
          .prepare(
            `SELECT id, owner_id AS ownerId, name, content,
                created_at AS createdAt, updated_at AS updatedAt
           FROM session_templates WHERE owner_id = ? ORDER BY name COLLATE NOCASE`,
          )
          .all(ownerId) as TemplateRow[]
      ).map(toTemplate);
    },

    saveTemplate(
      ownerId: string,
      input: { id?: string; name: string; content: string },
    ): SessionTemplate {
      let parsed: {
        title?: string;
        date?: string;
        notes?: string;
        status?: string;
      };
      try {
        parsed = JSON.parse(input.content);
      } catch {
        parsed = { notes: input.content };
      }
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
        throw new Error("Invalid session template");
      const safeContent = JSON.stringify({
        ...parsed,
        notes:
          typeof parsed.notes === "string"
            ? sanitizeRichText(parsed.notes)
            : "",
      });
      const id = input.id ?? crypto.randomUUID();
      const now = Date.now();
      database
        .prepare(
          `INSERT INTO session_templates
          (id, owner_id, name, content, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name, content = excluded.content,
           updated_at = excluded.updated_at
         WHERE session_templates.owner_id = excluded.owner_id`,
        )
        .run(
          id,
          ownerId,
          input.name.trim() || "Session template",
          safeContent,
          now,
          now,
        );
      const row = database
        .prepare(
          `SELECT id, owner_id AS ownerId, name, content,
                created_at AS createdAt, updated_at AS updatedAt
           FROM session_templates WHERE id = ? AND owner_id = ?`,
        )
        .get(id, ownerId) as TemplateRow | undefined;
      if (!row) throw new ResourceNotFoundError("session template", id);
      return toTemplate(row);
    },

    deleteTemplate(ownerId: string, id: string): void {
      const result = database
        .prepare("DELETE FROM session_templates WHERE id = ? AND owner_id = ?")
        .run(id, ownerId);
      if (!result.changes)
        throw new ResourceNotFoundError("session template", id);
    },

    setScreenshotReferences(
      campaignId: string,
      actorUserId: string,
      resourceType: string,
      resourceId: string,
      screenshotIds: string[],
    ): void {
      requireCampaignEdit(database, campaignId, actorUserId);
      database
        .prepare(
          "DELETE FROM screenshot_references WHERE campaign_id = ? AND resource_type = ? AND resource_id = ?",
        )
        .run(campaignId, resourceType, resourceId);
      const visible = database.prepare(
        `SELECT s.id FROM screenshots s
          WHERE s.id = ? AND (
            s.uploaded_by = ? OR EXISTS (
              SELECT 1 FROM screenshot_references r
              WHERE r.screenshot_id = s.id AND r.campaign_id = ?
            )
          ) LIMIT 1`,
      );
      const insert = database.prepare(
        `INSERT INTO screenshot_references
          (screenshot_id, campaign_id, resource_type, resource_id, created_at)
         VALUES (?, ?, ?, ?, ?)`,
      );
      for (const screenshotId of new Set(screenshotIds)) {
        if (!visible.get(screenshotId, actorUserId, campaignId))
          throw new ResourceNotFoundError("screenshot", screenshotId);
        insert.run(
          screenshotId,
          campaignId,
          resourceType,
          resourceId,
          Date.now(),
        );
      }
      recordAuditEvent(database, {
        campaignId,
        actorUserId,
        resourceType,
        resourceId,
        action: "screenshot_references_updated",
        details: { screenshotIds: [...new Set(screenshotIds)] },
      });
    },

    indexResource(
      campaignId: string,
      resourceType: string,
      resourceId: string,
      title: string,
      content: string,
    ): void {
      database
        .prepare(
          "DELETE FROM search_index WHERE campaign_id = ? AND resource_type = ? AND resource_id = ?",
        )
        .run(campaignId, resourceType, resourceId);
      database
        .prepare(
          `INSERT INTO search_index
          (campaign_id, resource_type, resource_id, title, content)
         VALUES (?, ?, ?, ?, ?)`,
        )
        .run(campaignId, resourceType, resourceId, title, content);
    },

    removeFromIndex(
      campaignId: string,
      resourceType: string,
      resourceId: string,
    ): void {
      database
        .prepare(
          "DELETE FROM search_index WHERE campaign_id = ? AND resource_type = ? AND resource_id = ?",
        )
        .run(campaignId, resourceType, resourceId);
    },

    search(
      campaignId: string,
      actorUserId: string,
      query: string,
      limit = 30,
      type = "all",
    ): CampaignSearchResult[] {
      requireCampaignRead(database, campaignId, actorUserId);
      const expression = searchExpression(query);
      if (!expression) return [];
      return database
        .prepare(
          `SELECT CASE WHEN resource_type = 'player' AND EXISTS (SELECT 1 FROM players p WHERE p.id = search_index.resource_id AND p.campaign_id = search_index.campaign_id AND p.kind = 'npc') THEN 'npc' ELSE resource_type END AS resourceType, resource_id AS resourceId,
                title, snippet(search_index, 4, '<mark>', '</mark>', '…', 18) AS excerpt,
                bm25(search_index) AS rank
           FROM search_index
          WHERE search_index MATCH ? AND campaign_id = ?
            AND (? = 'all' OR CASE WHEN resource_type = 'player' AND EXISTS (SELECT 1 FROM players p WHERE p.id = search_index.resource_id AND p.campaign_id = search_index.campaign_id AND p.kind = 'npc') THEN 'npc' ELSE resource_type END = ?)
          ORDER BY rank LIMIT ?`,
        )
        .all(
          expression,
          campaignId,
          type,
          type,
          Math.max(1, Math.min(limit, 100)),
        ) as CampaignSearchResult[];
    },
  };
}

export function searchExpression(query: string): string {
  return query
    .trim()
    .split(/\s+/)
    .map((term) => term.replace(/["*:^(){}\[\]]/g, ""))
    .filter(Boolean)
    .map((term) => `"${term}"*`)
    .join(" AND ");
}

function toTemplate(row: TemplateRow): SessionTemplate {
  return {
    ...row,
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString(),
  };
}
