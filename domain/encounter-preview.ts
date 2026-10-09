import type { CombatEncounter, PreparedEncounter } from "./encounters.ts";
export function previewPreparation(
  combat: CombatEncounter,
  prepared: PreparedEncounter,
) {
  const retained = combat.combatants.filter(({ kind }) => kind !== "monster");
  const replaced = combat.combatants.filter(({ kind }) => kind === "monster");
  const monsterCount = prepared.monsters.reduce(
    (sum, { quantity }) => sum + quantity,
    0,
  );
  const customCount = prepared.combatants?.length ?? 0;
  const duplicateNames = [
    ...new Set(
      (prepared.combatants ?? [])
        .filter(
          (incoming) =>
            incoming.kind !== "monster" &&
            retained.some(
              (current) =>
                current.kind === incoming.kind &&
                current.name.trim().toLowerCase() ===
                  incoming.name.trim().toLowerCase(),
            ),
        )
        .map(({ name }) => name),
    ),
  ];
  return {
    retained,
    replaced,
    monsterCount,
    customCount,
    total: retained.length + monsterCount + customCount,
    duplicateNames,
  };
}
