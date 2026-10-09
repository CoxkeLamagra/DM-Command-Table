import type { Combatant, CombatRuntime, CombatSnapshot } from "./encounters.ts";
export function emptyRuntime(): CombatRuntime {
  return {
    temporaryHitPoints: 0,
    concentration: null,
    deathSaves: { successes: 0, failures: 0 },
    resources: [],
  };
}
export function snapshotMonster(
  source: Pick<CombatSnapshot, "name" | "hitPoints" | "armorClass"> &
    Omit<Partial<CombatSnapshot>, "source"> & { source?: string | null },
): CombatSnapshot {
  return {
    name: source.name,
    hitPoints: source.hitPoints,
    armorClass: source.armorClass,
    type: source.type ?? "",
    challengeRating: source.challengeRating ?? "",
    speed: source.speed ?? "",
    stats: source.stats ?? "",
    abilities: source.abilities ?? "",
    spells: source.spells ?? "",
    notes: source.notes ?? "",
    source: source.source ?? "",
    spellSlots: [...(source.spellSlots ?? [])],
    tags: (source.tags ?? []).map((tag) => ({ ...tag })),
  };
}
export function runtimeForSnapshot(snapshot: CombatSnapshot): CombatRuntime {
  return {
    ...emptyRuntime(),
    resources: snapshot.spellSlots.flatMap((maximum, index) =>
      maximum > 0
        ? [
            {
              id: crypto.randomUUID(),
              name: `Level ${index + 1} spell slots`,
              maximum,
              remaining: maximum,
              reset: "manual" as const,
            },
          ]
        : [],
    ),
  };
}
export function combatRichText(entry: Combatant): string[] {
  return [
    entry.notes,
    entry.snapshot?.stats ?? "",
    entry.snapshot?.abilities ?? "",
    entry.snapshot?.spells ?? "",
    entry.snapshot?.notes ?? "",
  ];
}
export function applyHitPointChange(
  entry: Combatant,
  amount: number,
  action: "damage" | "heal",
): Pick<Combatant, "hitPoints" | "runtime"> {
  if (!Number.isFinite(amount) || amount <= 0)
    throw new Error("Enter an amount greater than zero.");
  const runtime = entry.runtime ?? emptyRuntime();
  const absorbed =
    action === "damage" ? Math.min(runtime.temporaryHitPoints, amount) : 0;
  const hitPoints =
    action === "damage"
      ? Math.max(0, entry.hitPoints - (amount - absorbed))
      : Math.min(entry.maximumHitPoints, entry.hitPoints + amount);
  return {
    hitPoints,
    runtime: {
      ...runtime,
      temporaryHitPoints: runtime.temporaryHitPoints - absorbed,
      deathSaves:
        action === "heal" && hitPoints > 0
          ? { successes: 0, failures: 0 }
          : { ...runtime.deathSaves },
    },
  };
}
