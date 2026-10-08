"use client";

export type RosterFilterValue = "all" | "player" | "npc";

export function RosterFilter({
  value,
  onChange,
  label = "Filter roster by type",
}: {
  value: RosterFilterValue;
  onChange: (value: RosterFilterValue) => void;
  label?: string;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-stone-400">
      Type
      <select
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value as RosterFilterValue)}
        className="rounded-md border border-white/10 bg-[#151820] px-3 py-2 text-stone-100"
      >
        <option value="all">All players &amp; NPCs</option>
        <option value="player">Players</option>
        <option value="npc">NPCs</option>
      </select>
    </label>
  );
}
