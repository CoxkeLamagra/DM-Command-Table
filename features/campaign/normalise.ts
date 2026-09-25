import type { CampaignState, Combatant } from "./types";

type LegacyCombatant = Omit<Combatant, "kind" | "conditions"> & {
  kind?: Combatant["kind"] | "hero";
  condition?: string;
  conditions?: Array<Combatant["conditions"][number] | string>;
};

/**
 * Applies backward-compatible defaults without changing the persisted payload
 * shape or assigning new identifiers.
 */
export function normaliseCampaign(value: CampaignState): CampaignState {
  return {
    ...value,
    campaignNotes: value.campaignNotes ?? "",
    encounterName: value.encounterName ?? "The Ashen Crossing",
    combatants: (value.combatants ?? []).map((combatant: LegacyCombatant) => ({
      ...combatant,
      number: combatant.number ?? null,
      kind: combatant.kind === "hero" ? "player" : combatant.kind || "monster",
      conditions: (
        combatant.conditions ??
        (combatant.condition ? [combatant.condition] : [])
      ).map((condition, index) =>
        typeof condition === "string"
          ? {
              id: `${combatant.id}-condition-${index}`,
              name: condition,
              remainingTurns: null,
            }
          : {
              ...condition,
              remainingTurns: condition.remainingTurns ?? null,
            },
      ),
    })),
    players: (value.players ?? []).map((player) => ({
      ...player,
      race: player.race ?? "",
      className: player.className ?? "",
      level: player.level ?? 1,
      notes: player.notes ?? "",
    })),
    monsters: (value.monsters ?? []).map((monster) => ({
      ...monster,
      notes: monster.notes ?? "",
    })),
    sessions: (value.sessions ?? []).map((session) => ({
      ...session,
      encounters: (session.encounters ?? []).map((encounter) => ({
        ...encounter,
        monsters: (encounter.monsters ?? []).map((monster) => ({
          ...monster,
          number: monster.number ?? null,
        })),
      })),
    })),
    story: (value.story ?? []).map((beat) => ({
      ...beat,
      sessionIds: beat.sessionIds ?? [],
    })),
  };
}
