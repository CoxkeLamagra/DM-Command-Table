import { memo } from "react";
import { richTextToPlainText } from "@/features/rich-text/rich-text";
import type { MonsterSummary, PreparedEncounter } from "@/domain/types";

export const EncounterSummary = memo(function EncounterSummary({
  encounter,
  monstersById,
}: {
  encounter: PreparedEncounter;
  monstersById: ReadonlyMap<string, MonsterSummary>;
}) {
  const custom = encounter.combatants ?? [];
  const counts = {
    monster: encounter.monsters.reduce((sum, entry) => sum + entry.quantity, 0),
    player: 0,
    npc: 0,
  };
  for (const { kind } of custom) counts[kind]++;
  const names = encounter.monsters
    .slice(0, 5)
    .map(
      (entry) =>
        `${entry.quantity} × ${monstersById.get(entry.monsterId)?.name ?? "Missing Bestiary record"}`,
    );
  for (const { name } of custom) {
    if (names.length === 5) break;
    names.push(name);
  }
  const nameCount = encounter.monsters.length + custom.length;
  const missing = encounter.monsters.some(
    (entry) => !monstersById.has(entry.monsterId),
  );
  const notes = richTextToPlainText(encounter.notes).trim();
  return (
    <div
      aria-label={`Summary for ${encounter.name}`}
      className="mt-2 space-y-1 pl-6 text-xs text-stone-400"
    >
      <p className="flex flex-wrap gap-x-3 gap-y-1">
        <span>{counts.monster + counts.player + counts.npc} combatants</span>
        <span className="text-red-300">{counts.monster} Monsters</span>
        <span className="text-emerald-300">{counts.player} Players</span>
        <span className="text-blue-300">{counts.npc} NPCs</span>
      </p>
      <p>
        {names.join(" · ") || "No combatants added yet."}
        {nameCount > 5 ? ` · +${nameCount - 5} more` : ""}
      </p>
      {notes && (
        <p className="line-clamp-2 text-stone-500">
          {notes.slice(0, 240)}
          {notes.length > 240 ? "…" : ""}
        </p>
      )}
      {missing && (
        <p className="text-amber-300">
          A Bestiary record is missing. Its monsters will be skipped when
          loading into Combat.
        </p>
      )}
    </div>
  );
});
