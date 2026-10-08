"use client";

import { useState } from "react";
import { Tabs } from "radix-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RosterFilter, type RosterFilterValue } from "./roster-filter";
import type { V6Player, V6Monster, V6Combatant } from "@/features/v6/types";

export type CombatantSelection = {
  singleUse?: SingleUseCombatant;
  playerIds: string[];
  monsters: { id: string; quantity: number }[];
};
export type SingleUseCombatant = {
  name: string;
  kind: V6Combatant["kind"];
  hitPoints: number;
  armorClass: number;
};

const tabClass =
  "rounded-md px-3 py-2 text-sm text-stone-400 outline-none focus-visible:ring-2 focus-visible:ring-amber-300 data-[state=active]:bg-white/10 data-[state=active]:text-amber-200";

export function CombatantPicker({
  open,
  onOpenChange,
  players,
  monsters,
  existingPlayerIds = new Set<string>(),
  onAdd,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  players: V6Player[];
  monsters: V6Monster[];
  existingPlayerIds?: Set<string>;
  onAdd: (selection: CombatantSelection) => void;
}) {
  // A new dialog session starts fresh; tab and search changes retain selections.
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && (
        <PickerContents
          players={players}
          monsters={monsters}
          existingPlayerIds={existingPlayerIds}
          onAdd={(selection) => {
            onAdd(selection);
            onOpenChange(false);
          }}
        />
      )}
    </Dialog>
  );
}

function PickerContents({
  players,
  monsters,
  existingPlayerIds,
  onAdd,
}: {
  players: V6Player[];
  monsters: V6Monster[];
  existingPlayerIds: Set<string>;
  onAdd: (selection: CombatantSelection) => void;
}) {
  const [source, setSource] = useState("roster");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<RosterFilterValue>("all");
  const [chosenPlayers, setChosenPlayers] = useState<Set<string>>(new Set());
  const [chosenMonsters, setChosenMonsters] = useState<Set<string>>(new Set());
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [single, setSingle] = useState<SingleUseCombatant>({
    name: "",
    kind: "npc",
    hitPoints: 10,
    armorClass: 10,
  });
  const [hp, setHp] = useState("10");
  const [ac, setAc] = useState("10");
  const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const matches = (value: string) =>
    terms.every((term) => value.toLowerCase().includes(term));
  const roster = players.filter(
    (entry) =>
      !existingPlayerIds.has(entry.id) &&
      (filter === "all" || (entry.kind ?? "player") === filter) &&
      matches(
        `${entry.name} ${entry.kind ?? "player"} ${entry.race} ${entry.className}`,
      ),
  );
  const bestiary = monsters.filter((entry) =>
    matches(
      `${entry.name} ${entry.type} ${entry.challengeRating} ${entry.source ?? ""}`,
    ),
  );
  const totalMonsters = [...chosenMonsters].reduce(
    (sum, id) => sum + (quantities[id] ?? 1),
    0,
  );
  const total = chosenPlayers.size + totalMonsters;
  function toggle(
    setter: React.Dispatch<React.SetStateAction<Set<string>>>,
    id: string,
    checked: boolean,
  ) {
    setter((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }
  const validSingle =
    single.name.trim().length > 0 &&
    single.name.trim().length <= 200 &&
    hp !== "" &&
    ac !== "" &&
    [Number(hp), Number(ac)].every(
      (value) => Number.isFinite(value) && value >= 0,
    );
  return (
    <DialogContent className="max-h-[90vh] overflow-y-auto border-white/10 bg-[#151820] text-stone-100 sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>Add combatants</DialogTitle>
      </DialogHeader>
      <Tabs.Root value={source} onValueChange={setSource}>
        <Tabs.List
          aria-label="Combatant source"
          className="flex flex-wrap gap-1 rounded-lg bg-black/20 p-1"
        >
          <Tabs.Trigger value="roster" className={tabClass}>
            Campaign roster
          </Tabs.Trigger>
          <Tabs.Trigger value="bestiary" className={tabClass}>
            Bestiary
          </Tabs.Trigger>
          <Tabs.Trigger value="single" className={tabClass}>
            Single-use
          </Tabs.Trigger>
        </Tabs.List>
        {source !== "single" && (
          <Input
            className="mt-3"
            aria-label="Search combatants"
            type="search"
            placeholder="Search combatants…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        )}
        <Tabs.Content value="roster" className="mt-3 space-y-3">
          <p className="text-sm text-stone-400">
            Import campaign Players and NPCs. Their roster records remain
            unchanged.
          </p>
          <RosterFilter value={filter} onChange={setFilter} />
          <div className="max-h-64 space-y-1 overflow-y-auto">
            {roster.map((entry) => (
              <label
                key={entry.id}
                className="flex cursor-pointer items-center gap-3 rounded p-2 hover:bg-white/5"
              >
                <Checkbox
                  aria-label={`Select ${entry.name}`}
                  checked={chosenPlayers.has(entry.id)}
                  onCheckedChange={(value) =>
                    toggle(setChosenPlayers, entry.id, value === true)
                  }
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{entry.name}</span>
                  <span className="text-xs text-stone-500">
                    HP {entry.hitPoints ?? 10} · AC {entry.armorClass ?? 10}
                  </span>
                </span>
                <span
                  className={`text-xs ${entry.kind === "npc" ? "text-blue-300" : "text-emerald-300"}`}
                >
                  {entry.kind === "npc" ? "NPC" : "Player"}
                </span>
              </label>
            ))}
            {!roster.length && (
              <p className="p-3 text-sm text-stone-500">
                No available players or NPCs match these filters.
              </p>
            )}
          </div>
        </Tabs.Content>
        <Tabs.Content value="bestiary" className="mt-3 space-y-3">
          <p className="text-sm text-stone-400">
            Choose monsters and the number of each to add.
          </p>
          <div className="max-h-64 space-y-1 overflow-y-auto">
            {bestiary.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center gap-3 rounded p-2 hover:bg-white/5"
              >
                <Checkbox
                  aria-label={`Select ${entry.name}`}
                  checked={chosenMonsters.has(entry.id)}
                  onCheckedChange={(value) =>
                    toggle(setChosenMonsters, entry.id, value === true)
                  }
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-red-300">
                    {entry.name}
                  </span>
                  <span className="text-xs text-stone-500">
                    {entry.type} · CR {entry.challengeRating} · HP{" "}
                    {entry.hitPoints} · AC {entry.armorClass}
                  </span>
                </span>
                <Input
                  aria-label={`Quantity for ${entry.name}`}
                  className="h-8 w-20"
                  type="number"
                  min={1}
                  max={99}
                  value={quantities[entry.id] ?? 1}
                  onChange={(event) => {
                    const quantity = Math.max(
                      1,
                      Math.min(
                        99,
                        Number.parseInt(event.target.value, 10) || 1,
                      ),
                    );
                    setQuantities((current) => ({
                      ...current,
                      [entry.id]: quantity,
                    }));
                    toggle(setChosenMonsters, entry.id, true);
                  }}
                />
              </div>
            ))}
            {!bestiary.length && (
              <p className="p-3 text-sm text-stone-500">
                No monsters match this search. Add monsters in Bestiary or
                create a single-use combatant.
              </p>
            )}
          </div>
        </Tabs.Content>
        <Tabs.Content value="single" className="mt-3 space-y-3">
          <p className="text-sm text-stone-400">
            Create a combatant for this encounter. This does not create a
            campaign roster or Bestiary record.
          </p>
          <label className="block text-sm">
            Type
            <select
              aria-label="Single-use type"
              value={single.kind}
              onChange={(event) =>
                setSingle({
                  ...single,
                  kind: event.target.value as SingleUseCombatant["kind"],
                })
              }
              className="ml-3 rounded border border-white/10 bg-[#151820] p-2"
            >
              <option value="player">Player</option>
              <option value="npc">NPC</option>
              <option value="monster">Monster</option>
            </select>
          </label>
          <label className="block text-sm">
            Name
            <Input
              aria-label="Single-use name"
              maxLength={200}
              value={single.name}
              onChange={(event) =>
                setSingle({ ...single, name: event.target.value })
              }
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm">
              Hit points
              <Input
                aria-label="Single-use hit points"
                type="number"
                min={0}
                value={hp}
                onChange={(event) => setHp(event.target.value)}
              />
            </label>
            <label className="text-sm">
              Armor class
              <Input
                aria-label="Single-use armor class"
                type="number"
                min={0}
                value={ac}
                onChange={(event) => setAc(event.target.value)}
              />
            </label>
          </div>
          <Button
            disabled={!validSingle}
            onClick={() =>
              onAdd({
                playerIds: [...chosenPlayers],
                monsters: [...chosenMonsters].map((id) => ({
                  id,
                  quantity: quantities[id] ?? 1,
                })),
                singleUse: {
                  ...single,
                  name: single.name.trim(),
                  hitPoints: Number(hp),
                  armorClass: Number(ac),
                },
              })
            }
          >
            {total
              ? `Add single-use & selected (${total + 1})`
              : "Add single-use combatant"}
          </Button>
        </Tabs.Content>
      </Tabs.Root>
      <div className="sticky bottom-0 space-y-2 border-t border-white/10 bg-[#151820] pt-3">
        <p role="status" aria-live="polite" className="text-sm text-stone-400">
          Selected: {chosenPlayers.size} roster · {totalMonsters} monsters (
          {total} total)
        </p>
        {source === "single" && total > 0 && (
          <p className="text-xs text-stone-500">
            Adding this single-use combatant also adds your roster and Bestiary
            selections.
          </p>
        )}
        <div className="flex items-center justify-between gap-2">
          <Button
            variant="ghost"
            disabled={!total}
            onClick={() => {
              setChosenPlayers(new Set());
              setChosenMonsters(new Set());
              setQuantities({});
            }}
          >
            Clear selection
          </Button>
          <Button
            disabled={!total}
            onClick={() =>
              onAdd({
                playerIds: [...chosenPlayers],
                monsters: [...chosenMonsters].map((id) => ({
                  id,
                  quantity: quantities[id] ?? 1,
                })),
              })
            }
          >
            Add selected ({total})
          </Button>
        </div>
      </div>
    </DialogContent>
  );
}
