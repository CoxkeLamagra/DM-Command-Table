import type { CampaignState, Combatant } from "./types";

type LegacyCombatant = Omit<Combatant, "kind"> & {
  kind?: Combatant["kind"] | "hero";
  condition?: string;
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
      conditions:
        combatant.conditions ??
        (combatant.condition ? [combatant.condition] : []),
    })),
    players: (value.players ?? []).map((player) => ({
      ...player,
      race: player.race ?? "",
      className: player.className ?? "",
      level: player.level ?? 1,
      notes: player.notes ?? "",
    })),
    monsters: value.monsters ?? [],
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
    story: value.story ?? [],
  };
}
