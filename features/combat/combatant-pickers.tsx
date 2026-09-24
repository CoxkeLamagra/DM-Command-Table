"use client";

import { useMemo, type Dispatch, type SetStateAction } from "react";
import { Library, Plus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { CampaignPlayer, Monster } from "@/features/campaign/types";

export function CampaignPlayerPicker({
  players,
  open,
  onOpenChange,
  selectedIds,
  setSelectedIds,
  onAdd,
}: {
  players: CampaignPlayer[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedIds: string[];
  setSelectedIds: Dispatch<SetStateAction<string[]>>;
  onAdd: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-md bg-amber-300 px-3 py-2 text-sm font-medium whitespace-nowrap text-black transition-all hover:bg-amber-200 [&_svg]:size-4">
        <Users /> Add campaign player
      </DialogTrigger>
      <DialogContent className="max-h-[80vh] overflow-y-auto border-amber-300/20 bg-[#12161e] text-stone-100">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl text-amber-100">
            Add campaign players
          </DialogTitle>
        </DialogHeader>
        {players.length ? (
          <>
            <label className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/20 p-3 text-sm text-stone-400">
              <input
                type="checkbox"
                className="size-4 accent-amber-300"
                checked={selectedIds.length === players.length}
                onChange={(event) =>
                  setSelectedIds(
                    event.target.checked ? players.map((player) => player.id) : [],
                  )
                }
              />
              Select all players
            </label>
            <div className="space-y-2">
              {players.map((player) => (
                <label
                  key={player.id}
                  className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition ${selectedIds.includes(player.id) ? "border-amber-300/30 bg-amber-300/[.05]" : "border-white/10 bg-black/20 hover:border-white/20"}`}
                >
                  <input
                    type="checkbox"
                    className="size-4 shrink-0 accent-amber-300"
                    checked={selectedIds.includes(player.id)}
                    onChange={() =>
                      setSelectedIds((current) =>
                        current.includes(player.id)
                          ? current.filter((id) => id !== player.id)
                          : [...current, player.id],
                      )
                    }
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-stone-200">
                      {player.name || "Unnamed player"}
                    </p>
                    <p className="mt-1 text-xs text-stone-500">
                      {[player.race, player.className].filter(Boolean).join(" · ") ||
                        "Race and class not set"} · HP {player.hp ?? "Not set"} · AC {player.ac ?? "Not set"}
                    </p>
                  </div>
                </label>
              ))}
            </div>
            <Button
              disabled={!selectedIds.length}
              onClick={onAdd}
              className="w-full bg-amber-300 text-black hover:bg-amber-200"
            >
              <Plus /> Add selected ({selectedIds.length})
            </Button>
          </>
        ) : (
          <div className="rounded-lg border border-dashed border-white/10 p-6 text-center text-sm text-stone-500">
            No saved players yet. Add them from the Players menu first.
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function BestiaryMonsterPicker({
  monsters,
  open,
  onOpenChange,
  search,
  setSearch,
  selectedIds,
  setSelectedIds,
  onAdd,
}: {
  monsters: Monster[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  search: string;
  setSearch: (value: string) => void;
  selectedIds: string[];
  setSelectedIds: Dispatch<SetStateAction<string[]>>;
  onAdd: () => void;
}) {
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return query
      ? monsters.filter((entry) =>
          [entry.name, entry.type, entry.source ?? "", entry.cr].some((value) =>
            String(value).toLowerCase().includes(query),
          ),
        )
      : monsters;
  }, [search, monsters]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-md bg-amber-300 px-3 py-2 text-sm font-medium whitespace-nowrap text-black transition-all hover:bg-amber-200 [&_svg]:size-4">
        <Library /> Add bestiary monster
      </DialogTrigger>
      <DialogContent className="max-h-[80vh] overflow-y-auto border-amber-300/20 bg-[#12161e] text-stone-100">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl text-amber-100">
            Add bestiary monsters
          </DialogTitle>
        </DialogHeader>
        {monsters.length ? (
          <>
            <Input
              autoFocus
              aria-label="Search bestiary monsters"
              className="border-white/10 bg-black/20"
              placeholder="Search by name, type, source, or CR…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <div className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/20 p-3">
              <label className="flex items-center gap-2 text-sm text-stone-400">
                <input
                  type="checkbox"
                  className="size-4 accent-amber-300"
                  checked={
                    filtered.length > 0 &&
                    filtered.every((entry) => selectedIds.includes(entry.id))
                  }
                  onChange={(event) =>
                    setSelectedIds((current) =>
                      event.target.checked
                        ? [...new Set([...current, ...filtered.map((entry) => entry.id)])]
                        : current.filter(
                            (id) => !filtered.some((entry) => entry.id === id),
                          ),
                    )
                  }
                />
                Select all visible
              </label>
              <span className="text-xs text-stone-500">{filtered.length} results</span>
            </div>
            {filtered.length ? (
              <div className="space-y-2">
                {filtered.map((entry) => (
                  <label
                    key={entry.id}
                    className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition ${selectedIds.includes(entry.id) ? "border-amber-300/30 bg-amber-300/[.05]" : "border-white/10 bg-black/20 hover:border-white/20"}`}
                  >
                    <input
                      type="checkbox"
                      className="size-4 shrink-0 accent-amber-300"
                      checked={selectedIds.includes(entry.id)}
                      onChange={() =>
                        setSelectedIds((current) =>
                          current.includes(entry.id)
                            ? current.filter((id) => id !== entry.id)
                            : [...current, entry.id],
                        )
                      }
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-stone-200">{entry.name}</p>
                      <p className="mt-1 text-xs text-stone-500">
                        {entry.type} · CR {entry.cr} · HP {entry.hp} · AC {entry.ac}
                        {entry.source ? ` · ${entry.source}` : ""}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-white/10 p-6 text-center text-sm text-stone-500">
                No monsters match “{search}”.
              </div>
            )}
            <Button
              disabled={!selectedIds.length}
              onClick={onAdd}
              className="w-full bg-amber-300 text-black hover:bg-amber-200"
            >
              <Plus /> Add selected ({selectedIds.length})
            </Button>
          </>
        ) : (
          <div className="rounded-lg border border-dashed border-white/10 p-6 text-center text-sm text-stone-500">
            No monsters in the Bestiary yet.
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
