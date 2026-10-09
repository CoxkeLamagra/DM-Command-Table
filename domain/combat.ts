import { MAX_COMBATANTS } from "./limits.ts";
import type {
  CombatEncounter,
  Combatant,
  PreparedEncounter,
} from "./encounters.ts";
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
        current.combatants.findIndex((entry) => entry.hitPoints > 0),
      ),
    };
  const entries = current.combatants;
  if (!entries.some((entry) => entry.hitPoints > 0)) return current;
  let next = current.turn,
    wrapped = false;
  for (let step = 1; step <= entries.length; step++) {
    const candidate = (current.turn + step) % entries.length;
    if (candidate <= current.turn) wrapped = true;
    if (entries[candidate].hitPoints > 0) {
      next = candidate;
      break;
    }
  }
  return {
    ...current,
    turn: next,
    round: current.round + (wrapped ? 1 : 0),
    combatants: entries.map((entry, index) =>
      index === next
        ? {
            ...entry,
            conditions: entry.conditions.flatMap((condition) =>
              condition.remainingTurns === null
                ? [condition]
                : condition.remainingTurns > 1
                  ? [
                      {
                        ...condition,
                        remainingTurns: condition.remainingTurns - 1,
                      },
                    ]
                  : [],
            ),
          }
        : entry,
    ),
  };
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

type MonsterSource = {
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
      revision: 1,
    }));
  });
  const copies: Combatant[] = (prepared.combatants ?? []).map((entry) => ({
    ...entry,
    id: id(),
    playerId: null,
    monsterId: null,
    conditions: [],
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
