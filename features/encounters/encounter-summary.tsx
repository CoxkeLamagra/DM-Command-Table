import { richTextToPlainText } from "@/features/rich-text/rich-text";
import type { V6Monster, V6PreparedEncounter } from "@/features/v6/types";

export function EncounterSummary({
  encounter,
  monsters,
}: {
  encounter: V6PreparedEncounter;
  monsters: V6Monster[];
}) {
  const custom = encounter.combatants ?? [];
  const counts = {
    monster:
      encounter.monsters.reduce((sum, entry) => sum + entry.quantity, 0) +
      custom.filter(({ kind }) => kind === "monster").length,
    player: custom.filter(({ kind }) => kind === "player").length,
    npc: custom.filter(({ kind }) => kind === "npc").length,
  };
  const names = [
    ...encounter.monsters.map(
      (entry) =>
        `${entry.quantity} × ${monsters.find(({ id }) => id === entry.monsterId)?.name ?? "Missing Bestiary record"}`,
    ),
    ...custom.map(({ name }) => name),
  ];
  const missing = encounter.monsters.some(
    (entry) => !monsters.some(({ id }) => id === entry.monsterId),
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
        {names.slice(0, 5).join(" · ") || "No combatants added yet."}
        {names.length > 5 ? ` · +${names.length - 5} more` : ""}
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
}
