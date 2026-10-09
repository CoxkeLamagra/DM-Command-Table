import {
  emptyRuntime,
  runtimeForSnapshot,
  snapshotMonster,
} from "./combat-runtime.ts";
import { MAX_COMBATANTS } from "./limits.ts";
import type {
  CombatEncounter,
  Combatant,
  CombatCondition,
  CombatSnapshot,
  PreparedEncounter,
} from "./encounters.ts";
export type ZeroHpPolicy = "skip-all" | "include-players" | "include-all";
export function takesTurn(
  entry: Combatant,
  policy: ZeroHpPolicy = "skip-all",
): boolean {
  return (
    entry.hitPoints > 0 ||
    policy === "include-all" ||
    (policy === "include-players" && entry.kind === "player")
  );
}
export type CombatAction =
  "next-turn" | "reset-rounds" | "remove-monsters" | "clear";
export function orderedCombatants(entries: Combatant[]): Combatant[] {
  return [...entries].sort(
    (a, b) =>
      b.initiative - a.initiative ||
      a.sortOrder - b.sortOrder ||
      a.id.localeCompare(b.id),
  );
}
export function normalizeCombat(combat: CombatEncounter): CombatEncounter {
  const combatants = orderedCombatants(combat.combatants);
  return {
    ...combat,
    combatants,
    turn: combatants.length ? Math.min(combat.turn, combatants.length - 1) : 0,
  };
}
export function applyCombatAction(
  combat: CombatEncounter,
  action: CombatAction,
  zeroHpPolicy: ZeroHpPolicy = "skip-all",
): CombatEncounter {
  const current = normalizeCombat(combat);
  if (action === "clear")
    return { ...current, combatants: [], round: 1, turn: 0 };
  if (action === "remove-monsters")
    return {
      ...current,
      round: 1,
      turn: 0,
      combatants: current.combatants.filter(
        (entry) => entry.kind !== "monster",
      ),
    };
  if (action === "reset-rounds")
    return {
      ...current,
      round: 1,
      turn: Math.max(
        0,
        current.combatants.findIndex((entry) => takesTurn(entry, zeroHpPolicy)),
      ),
    };
  const entries = current.combatants;
  if (!entries.some((entry) => takesTurn(entry, zeroHpPolicy))) return current;
  let next = current.turn,
    wrapped = false;
  for (let step = 1; step <= entries.length; step++) {
    const candidate = (current.turn + step) % entries.length;
    if (candidate <= current.turn) wrapped = true;
    if (takesTurn(entries[candidate], zeroHpPolicy)) {
      next = candidate;
      break;
    }
  }
  return {
    ...current,
    turn: next,
    round: current.round + (wrapped ? 1 : 0),
    combatants: entries.map((entry, index) => {
      let conditions = entry.conditions;
      if (index === current.turn)
        conditions = tickConditions(conditions, "end-turn");
      if (index === next) conditions = tickConditions(conditions, "start-turn");
      const runtime = entry.runtime ?? emptyRuntime();
      return {
        ...entry,
        conditions,
        runtime:
          index === next
            ? {
                ...runtime,
                resources: runtime.resources.map((resource) =>
                  resource.reset === "start-turn"
                    ? { ...resource, remaining: resource.maximum }
                    : resource,
                ),
              }
            : runtime,
      };
    }),
  };
}
export function tickConditions(
  conditions: CombatCondition[],
  phase: "start-turn" | "end-turn",
): CombatCondition[] {
  return conditions.flatMap((condition) => {
    const timing =
      condition.timing ??
      (condition.remainingTurns === null ? "manual" : "start-turn");
    if (timing !== phase) return [condition];
    if (condition.remainingTurns !== null && condition.remainingTurns > 1)
      return [{ ...condition, remainingTurns: condition.remainingTurns - 1 }];
    if (condition.requiresSave)
      return [{ ...condition, remainingTurns: null, saveDue: true }];
    return condition.remainingTurns === null ? [condition] : [];
  });
}
export class CombatCapacityError extends Error {
  constructor() {
    super("Combat supports at most 10,000 combatants.");
    this.name = "CombatCapacityError";
  }
}

export function assertPreparedCapacity(
  prepared: Pick<PreparedEncounter, "monsters" | "combatants">,
  retainedCount = 0,
): void {
  if (
    prepared.monsters.some(
      ({ quantity }) => !Number.isSafeInteger(quantity) || quantity < 1,
    )
  )
    throw new CombatCapacityError();
  const total =
    retainedCount +
    (prepared.combatants?.length ?? 0) +
    prepared.monsters.reduce((sum, entry) => sum + entry.quantity, 0);
  if (!Number.isSafeInteger(total) || total > MAX_COMBATANTS)
    throw new CombatCapacityError();
}

type MonsterSource = Omit<Partial<CombatSnapshot>, "source"> & {
  source?: string | null;
  id: string;
  name: string;
  hitPoints: number;
  armorClass: number;
};
export function loadPreparation(
  combat: CombatEncounter,
  prepared: PreparedEncounter,
  sources: MonsterSource[],
  id: () => string = () => crypto.randomUUID(),
): CombatEncounter {
  const survivors = combat.combatants.filter(
    (entry) => entry.kind !== "monster",
  );
  assertPreparedCapacity(prepared, survivors.length);
  const additions: Combatant[] = prepared.monsters.flatMap((entry) => {
    const source = sources.find((value) => value.id === entry.monsterId);
    if (!source) throw new Error("A prepared monster no longer exists.");
    return Array.from({ length: entry.quantity }, (_, offset) => ({
      id: id(),
      playerId: null,
      monsterId: source.id,
      name: source.name,
      displayNumber: (entry.displayNumber ?? 1) + offset,
      kind: "monster" as const,
      notes: "",
      initiative: 10,
      hitPoints: source.hitPoints,
      maximumHitPoints: source.hitPoints,
      armorClass: source.armorClass,
      sortOrder: 0,
      conditions: [],
      snapshot: snapshotMonster(source),
      runtime: runtimeForSnapshot(snapshotMonster(source)),
      revision: 1,
    }));
  });
  const copies: Combatant[] = (prepared.combatants ?? []).map((entry) => ({
    ...entry,
    id: id(),
    playerId: null,
    monsterId: null,
    conditions: [],
    snapshot: null,
    runtime: emptyRuntime(),
    revision: 1,
  }));
  return normalizeCombat({
    ...combat,
    name: prepared.name || "Prepared encounter",
    round: 1,
    turn: 0,
    combatants: [...survivors, ...additions, ...copies].map(
      (entry, sortOrder) => ({ ...entry, sortOrder }),
    ),
  });
}
