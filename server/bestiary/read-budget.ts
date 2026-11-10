import type { DatabaseSync } from "node:sqlite";
import { exportByteLimit } from "../campaigns/export-budget.ts";
import { PublicApiError } from "../http/errors.ts";

export function monsterSelection(ids?: string[]) {
  if (ids && ids.length > 10_000)
    throw new PublicApiError("Select at most 10,000 monsters.", 413);
  return {
    sql: ids ? ` AND m.id IN (${ids.map(() => "?").join(",") || "NULL"})` : "",
    args: ids ?? [],
  };
}

export function assertMonsterReadBudget(
  database: DatabaseSync,
  campaignId: string,
  ids?: string[],
  quantities?: Map<string, number>,
) {
  const selection = monsterSelection(ids);
  const limit = exportByteLimit();
  let bytes = 0;
  // Charge each binding, not each shared definition, before .all()/JSON.parse.
  for (const row of database
    .prepare(
      `SELECT m.id,
    1024 + 2*length(CAST(d.payload AS BLOB)) + COALESCE((
      SELECT SUM(512 + 2*length(CAST(t.name AS BLOB)))
      FROM monster_tags mt JOIN tags t ON t.id=mt.tag_id WHERE mt.monster_id=m.id
    ),0) AS bytes FROM monsters m JOIN monster_definitions d ON d.id=m.definition_id
    WHERE m.campaign_id=?${selection.sql}`,
    )
    .iterate(campaignId, ...selection.args) as Iterable<{
    id: string;
    bytes: number;
  }>) {
    bytes += Number(row.bytes) * (quantities?.get(row.id) ?? 1);
    if (bytes > limit)
      throw new PublicApiError(
        "Monster details exceed the safe read budget. Use the paginated Bestiary or select fewer combatants.",
        413,
      );
  }
}
