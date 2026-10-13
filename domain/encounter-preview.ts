import type { CombatEncounter, PreparedEncounter } from "./encounters.ts";
import { uniquePlayers } from "./combat.ts";
export function previewPreparation(
  combat: CombatEncounter,
  prepared: PreparedEncounter,
) {
  const incoming = prepared.combatants ?? [];
  const copies = uniquePlayers(incoming);
  const monsterCount = prepared.monsters.reduce(
    (sum, { quantity }) => sum + quantity,
    0,
  );
  return {
    replaced: combat.combatants,
    monsterCount,
    customCount: copies.length,
    total: monsterCount + copies.length,
    mergedPlayers: incoming.length - copies.length,
  };
}
