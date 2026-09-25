import type {
  CampaignPlayer,
  CombatCondition,
  Combatant,
  Monster,
  PreparedEncounter,
} from "@/features/campaign/types";

type IdFactory = () => string;

export function orderCombatants(combatants: Combatant[]): Combatant[] {
  return [...combatants].sort((a, b) => b.initiative - a.initiative);
}

export function advanceCombatTurn(
  ordered: Combatant[],
  turn: number,
  round: number,
): { turn: number; round: number } | null {
  if (!ordered.length) return null;
  for (let step = 1; step <= ordered.length; step++) {
    const candidate = (turn + step) % ordered.length;
    if (ordered[candidate].hp > 0) {
      return {
        turn: candidate,
        round: candidate <= turn ? round + 1 : round,
      };
    }
  }
  return null;
}

export function tickConditions(conditions: CombatCondition[]): CombatCondition[] {
  return conditions.flatMap((condition) => {
    if (condition.remainingTurns === null) return [condition];
    const remainingTurns = condition.remainingTurns - 1;
    return remainingTurns > 0 ? [{ ...condition, remainingTurns }] : [];
  });
}

export function createPlayerCombatants(
  players: CampaignPlayer[],
  selectedIds: string[],
  createId: IdFactory,
): Combatant[] {
  return players
    .filter((player) => selectedIds.includes(player.id))
    .map((player) => {
      const hp = player.hp ?? 10;
      return {
        id: createId(),
        name: player.name,
        kind: "player" as const,
        initiative: 10,
        hp,
        maxHp: hp,
        ac: player.ac ?? 10,
        conditions: [],
        campaignPlayerId: player.id,
      };
    });
}

export function createMonsterCombatants(
  monsters: Monster[],
  selectedIds: string[],
  existing: Combatant[],
  createId: IdFactory,
): Combatant[] {
  const entries = monsters.filter((monster) => selectedIds.includes(monster.id));
  const nextNumbers = new Map<string, number>();
  for (const entry of entries) {
    const numbers = existing
      .filter(
        (combatant) =>
          combatant.kind === "monster" && combatant.monsterId === entry.id,
      )
      .map((combatant) => combatant.number ?? 0);
    nextNumbers.set(entry.id, Math.max(0, ...numbers) + 1);
  }
  return entries.map((entry) => {
    const number = nextNumbers.get(entry.id) ?? 1;
    nextNumbers.set(entry.id, number + 1);
    return {
      id: createId(),
      name: entry.name,
      number,
      kind: "monster" as const,
      initiative: 10,
      hp: entry.hp,
      maxHp: entry.hp,
      ac: entry.ac,
      conditions: [],
      monsterId: entry.id,
    };
  });
}

export function createPreparedCombatants(
  encounter: PreparedEncounter,
  monsters: Monster[],
  createId: IdFactory,
): Combatant[] {
  return encounter.monsters.flatMap((reference) => {
    const monster = monsters.find((entry) => entry.id === reference.monsterId);
    return monster
      ? [{
          id: createId(),
          name: monster.name,
          number: reference.number ?? null,
          kind: "monster" as const,
          initiative: 10,
          hp: monster.hp,
          maxHp: monster.hp,
          ac: monster.ac,
          conditions: [],
          monsterId: monster.id,
        }]
      : [];
  });
}

export function turnAfterRemovingMonsters(
  ordered: Combatant[],
  turn: number,
): number {
  const survivors = ordered.filter((combatant) => combatant.kind !== "monster");
  const active = ordered[turn];
  const next =
    active?.kind !== "monster"
      ? survivors.findIndex((combatant) => combatant.id === active.id)
      : survivors.findIndex((combatant) => combatant.hp > 0);
  return Math.max(0, next);
}
