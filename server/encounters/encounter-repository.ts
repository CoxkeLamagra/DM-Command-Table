import type { DatabaseSync } from "node:sqlite";
import { createPreparedRepository } from "./prepared-repository.ts";
import { createCombatRepository } from "./combat-repository.ts";
export type {
  PreparedMonster,
  PreparedEncounter,
  CombatCondition,
  Combatant,
  CombatEncounter,
} from "../../domain/encounters.ts";
export function createEncounterRepository(database: DatabaseSync) {
  return {
    ...createPreparedRepository(database),
    ...createCombatRepository(database),
  };
}
