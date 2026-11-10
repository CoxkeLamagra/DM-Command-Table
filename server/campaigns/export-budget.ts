import { getHeapStatistics } from "node:v8";
import type { DatabaseSync } from "node:sqlite";
import { CAMPAIGN_PACKAGE_LIMIT } from "../../domain/limits.ts";
import { campaignRole } from "./access.ts";
import { PublicApiError } from "../http/errors.ts";

export function exportTooLarge(): PublicApiError {
  return new PublicApiError(
    "Campaign export exceeds the safe export budget (up to 50 MB). Use a full server backup for larger campaigns.",
    413,
  );
}

// Keep room for parsed records, validation copies and final JSON/base64 output.
// Small-memory hosts must reject safely even below the format's absolute cap.
export function exportByteLimit(): number {
  const heap = getHeapStatistics();
  return Math.min(
    CAMPAIGN_PACKAGE_LIMIT,
    Math.max(
      0,
      Math.floor(
        (heap.heap_size_limit - heap.used_heap_size - 32 * 1024 * 1024) / 8,
      ),
    ),
  );
}

// Calculate in SQLite before repositories materialize rich text, nested JSON,
// or arrays. json_object accounts for escaping; BLOB length counts UTF-8 bytes.
// The small per-row reserve covers output key names, ISO dates and nesting.
export function assertCampaignExportBudget(
  database: DatabaseSync,
  campaignId: string,
  actorId: string,
): void {
  if (!campaignRole(database, campaignId, actorId))
    throw new PublicApiError("Campaign not found.", 404);
  const limit = exportByteLimit();
  let bytes = 1024;
  const charge = (sql: string) => {
    for (const row of database.prepare(sql).iterate(campaignId) as Iterable<{
      bytes: number;
    }>) {
      bytes += Number(row.bytes);
      if (bytes > limit) throw exportTooLarge();
    }
  };
  const rows = (table: string, from: string, where: string) => {
    const columns = database.prepare(`PRAGMA table_info(${table})`).all() as {
      name: string;
    }[];
    const fields = columns
      .flatMap(({ name }) => [
        `'${name}'`,
        table === "combatants" && ["runtime", "snapshot"].includes(name)
          ? `json(r."${name}")`
          : `r."${name}"`,
      ])
      .join(",");
    charge(
      `SELECT length(CAST(json_object(${fields}) AS BLOB))+128 AS bytes FROM ${from} WHERE ${where}`,
    );
  };
  rows("campaigns", "campaigns r", "r.id=?");
  rows("monsters", "monsters r", "r.campaign_id=?");
  charge(
    "SELECT length(CAST(d.payload AS BLOB)) AS bytes FROM monsters m JOIN monster_definitions d ON d.id=m.definition_id WHERE m.campaign_id=?",
  );
  rows("tags", "tags r", "r.campaign_id=?");
  rows(
    "tags",
    "tags r JOIN monster_tags mt ON mt.tag_id=r.id JOIN monsters m ON m.id=mt.monster_id",
    "m.campaign_id=?",
  );
  for (const table of ["players", "sessions", "story_beats"])
    rows(table, `${table} r`, "r.campaign_id=?");
  rows(
    "story_session_links",
    "story_session_links r JOIN story_beats s ON s.id=r.story_beat_id",
    "s.campaign_id=?",
  );
  rows(
    "prepared_encounters",
    "prepared_encounters r JOIN sessions s ON s.id=r.session_id",
    "s.campaign_id=?",
  );
  for (const table of ["prepared_encounter_monsters", "prepared_combatants"])
    rows(
      table,
      `${table} r JOIN prepared_encounters p ON p.id=r.encounter_id JOIN sessions s ON s.id=p.session_id`,
      "s.campaign_id=?",
    );
  rows("combat_encounters", "combat_encounters r", "r.campaign_id=?");
  rows(
    "combatants",
    "combatants r JOIN combat_encounters c ON c.id=r.encounter_id",
    "c.campaign_id=?",
  );
  rows(
    "combat_conditions",
    "combat_conditions r JOIN combatants b ON b.id=r.combatant_id JOIN combat_encounters c ON c.id=b.encounter_id",
    "c.campaign_id=?",
  );
}
