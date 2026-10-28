import type { Combatant, MonsterSummary, Player } from "../../domain/types.ts";

export function combatantSummary(
  item: Combatant,
  players: Player[],
  monsters: MonsterSummary[],
) {
  // Prepared combatants are independent copies without roster IDs. Only use
  // an unambiguous same-kind name match for their descriptive roster details.
  const matches =
    item.kind === "monster"
      ? []
      : players.filter(
          (player) =>
            player.kind === item.kind &&
            player.name.trim().toLowerCase() === item.name.trim().toLowerCase(),
        );
  const player =
    item.kind === "monster"
      ? undefined
      : item.playerId
        ? players.find(
            ({ id, kind }) => id === item.playerId && kind === item.kind,
          )
        : matches.length === 1
          ? matches[0]
          : undefined;
  const monster =
    item.snapshot ??
    (item.monsterId
      ? monsters.find(({ id }) => id === item.monsterId)
      : undefined);
  if (player)
    return [
      player.race,
      player.className,
      item.kind === "npc" ? "NPC" : "Player",
      `AC ${item.armorClass}`,
    ]
      .filter(Boolean)
      .join(" · ");
  if (item.kind === "monster" && monster)
    return [
      monster.type,
      `CR ${monster.challengeRating}`,
      "Monster",
      `AC ${item.armorClass}`,
    ]
      .filter(Boolean)
      .join(" · ");
  return `${item.kind === "player" ? "Player" : item.kind === "npc" ? "NPC" : "Monster"} · AC ${item.armorClass}`;
}
