import type { DatabaseSync } from "node:sqlite";
import { statement } from "../../db/statements.ts";
import { runTransaction } from "../../db/transaction.ts";

// `search_index` is an FTS5 table whose campaign/type/id columns are
// UNINDEXED, so filtering on them scans every indexed record on the server.
// `search_index_rows` (migration 4) maps each record to its FTS rowid, so
// replacing or removing one entry touches exactly one row.

/** Replaces the search entry for one record. */
export function writeSearchEntry(
  database: DatabaseSync,
  campaignId: string,
  resourceType: string,
  resourceId: string,
  title: string,
  content: string,
): void {
  runTransaction(database, () => {
    removeEntry(database, campaignId, resourceType, resourceId);
    const { lastInsertRowid } = statement(
      database,
      "INSERT INTO search_index (campaign_id,resource_type,resource_id,title,content) VALUES (?,?,?,?,?)",
    ).run(campaignId, resourceType, resourceId, title, content);
    statement(
      database,
      "INSERT INTO search_index_rows (campaign_id,resource_type,resource_id,search_rowid) VALUES (?,?,?,?)",
    ).run(campaignId, resourceType, resourceId, lastInsertRowid);
  });
}

/** Removes the search entry for one record, if it has one. */
export function removeSearchEntry(
  database: DatabaseSync,
  campaignId: string,
  resourceType: string,
  resourceId: string,
): void {
  runTransaction(database, () =>
    removeEntry(database, campaignId, resourceType, resourceId),
  );
}

function removeEntry(
  database: DatabaseSync,
  campaignId: string,
  resourceType: string,
  resourceId: string,
): void {
  const row = statement(
    database,
    "SELECT search_rowid AS rowid FROM search_index_rows WHERE campaign_id=? AND resource_type=? AND resource_id=?",
  ).get(campaignId, resourceType, resourceId) as
    { rowid: number | bigint } | undefined;
  if (!row) return;
  statement(database, "DELETE FROM search_index WHERE rowid=?").run(row.rowid);
  statement(
    database,
    "DELETE FROM search_index_rows WHERE campaign_id=? AND resource_type=? AND resource_id=?",
  ).run(campaignId, resourceType, resourceId);
}
