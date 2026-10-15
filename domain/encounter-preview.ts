import type { CombatEncounter, PreparedEncounter } from "./encounters.ts";
import { uniquePlayers } from "./combat.ts";
export function previewPreparation(
  combat: CombatEncounter,
  prepared: PreparedEncounter,
  preservePlayersAndNpcs = false,
) {
  const incoming = (prepared.combatants ?? []).filter(
    ({ kind }) => !preservePlayersAndNpcs || kind === "monster",
  );
  const retained = preservePlayersAndNpcs
    ? combat.combatants.filter(({ kind }) => kind !== "monster")
    : [];
  const copies = uniquePlayers(incoming);
  const monsterCount = prepared.monsters.reduce(
    (sum, { quantity }) => sum + quantity,
    0,
  );
  return {
    replaced: combat.combatants.filter(
      ({ kind }) => !preservePlayersAndNpcs || kind === "monster",
    ),
    retained,
    monsterCount,
    customCount: copies.length,
    total: retained.length + monsterCount + copies.length,
    mergedPlayers: incoming.length - copies.length,
  };
}
