import { createHash } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { statement } from "../../db/statements.ts";
import type { Monster } from "../../domain/types.ts";

type DefinitionInput = Pick<
  Monster,
  | "name"
  | "type"
  | "challengeRating"
  | "armorClass"
  | "hitPoints"
  | "speed"
  | "stats"
  | "token"
  | "abilities"
  | "spells"
  | "notes"
  | "spellSlots"
  | "source"
>;

// Fixed field ordering makes full-content equality deterministic. Never match
// by name/source alone: rule changes and campaign edits must not leak across campaigns.
export function monsterPayload(input: DefinitionInput): string {
  return JSON.stringify({
    name: input.name,
    type: input.type,
    challengeRating: input.challengeRating,
    armorClass: input.armorClass,
    hitPoints: input.hitPoints,
    speed: input.speed,
    stats: input.stats,
    token: input.token ?? "",
    abilities: input.abilities,
    spells: input.spells,
    notes: input.notes,
    spellSlots: input.spellSlots,
    source: input.source,
  });
}

export function storeMonsterDefinition(
  database: DatabaseSync,
  campaignId: string,
  payload: string,
  shared: boolean,
): string {
  const hash = createHash("sha256").update(payload).digest("hex");
  if (shared) {
    const existing = statement(
      database,
      "SELECT id,payload FROM monster_definitions WHERE scope_campaign_id IS NULL AND content_hash=?",
    ).get(hash) as { id: string; payload: string } | undefined;
    if (existing) {
      if (existing.payload !== payload)
        throw new Error("Monster definition hash collision.");
      return existing.id;
    }
  }
  const id = crypto.randomUUID();
  statement(
    database,
    "INSERT INTO monster_definitions(id,scope_campaign_id,payload,content_hash) VALUES(?,?,?,?)",
  ).run(id, shared ? null : campaignId, payload, hash);
  return id;
}
