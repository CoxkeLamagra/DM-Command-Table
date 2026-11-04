import type { DatabaseSync, SQLInputValue } from "node:sqlite";
import { allocationByteLimit } from "./allocation-budget.ts";
import { PublicApiError } from "../http/errors.ts";

type Table =
  | "players"
  | "sessions"
  | "story_beats"
  | "story_session_links"
  | "prepared_encounters"
  | "prepared_encounter_monsters"
  | "prepared_combatants"
  | "combatants"
  | "combat_conditions"
  | "session_templates"
  | "campaigns"
  | "screenshots";
const columns = new WeakMap<DatabaseSync, Map<Table, string[]>>();

// A budget belongs to a whole assembled result, including relationship rows.
// SQL measures UTF-8 before any notes/snapshots enter the JavaScript heap.
export function createReadBudget(database: DatabaseSync) {
  const limit = allocationByteLimit();
  let bytes = 0;
  return {
    table(table: Table, where: string, params: SQLInputValue[]) {
      let cached = columns.get(database);
      if (!cached) {
        cached = new Map();
        columns.set(database, cached);
      }
      let names = cached.get(table);
      if (!names) {
        names = (
          database.prepare(`PRAGMA table_info("${table}")`).all() as {
            name: string;
          }[]
        ).map(({ name }) => name);
        cached.set(table, names);
      }
      const costs = names
        .map((name) => `2*COALESCE(length(CAST(r."${name}" AS BLOB)),0)`)
        .join("+");
      for (const row of database
        .prepare(
          `SELECT 1024+${costs} AS bytes FROM "${table}" r WHERE ${where}`,
        )
        .iterate(...params) as Iterable<{ bytes: number }>) {
        bytes += Number(row.bytes);
        if (bytes > limit)
          throw new PublicApiError(
            "This collection exceeds the safe read budget. Reduce its size or use a full server backup.",
            413,
          );
      }
    },
  };
}
