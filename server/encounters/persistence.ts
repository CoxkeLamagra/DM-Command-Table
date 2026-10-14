import type { DatabaseSync } from "node:sqlite";
import { assertUpdated } from "../support/resource-persistence.ts";
export { changed as touch } from "../support/resource-persistence.ts";
export function conflictOrMissing(
  database: DatabaseSync,
  table: "prepared_encounters" | "combat_encounters",
  type: string,
  id: string,
  expectedRevision: number,
  campaignId: string,
): void {
  assertUpdated(database, table, type, id, expectedRevision, 0, campaignId);
}
