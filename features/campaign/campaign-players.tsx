"use client";

import { useState } from "react";
import { Plus, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScreenTitle } from "@/features/shared/ui";
import { NoteContent } from "@/features/screenshots/screenshot-notes";
import { useScreenshotLibrary } from "@/features/screenshots/use-screenshot-library";
import { createId } from "./id";
import type { CampaignPatch, CampaignPlayer, CampaignState } from "./types";
import { PlayerEditor } from "./player-editor";

const uid = createId;

export function CampaignPlayers({
  data,
  patch,
}: {
  data: CampaignState;
  patch: CampaignPatch;
}) {
  const { screenshots, upload } = useScreenshotLibrary();
  const [viewMode, setViewMode] = useState<"cards" | "list">("list");
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
  const update = (id: string, part: Partial<CampaignPlayer>) =>
    patch(
      "players",
      data.players.map((player) =>
        player.id === id ? { ...player, ...part } : player,
      ),
    );
  const add = () =>
    patch("players", [
      ...data.players,
      {
        id: uid(),
        name: "New player",
        race: "",
        className: "",
        level: 1,
        hp: null,
        ac: null,
        notes: "",
      },
    ]);
  function deletePlayers(ids: string[]) {
    if (!ids.length) return;
    const names = data.players
      .filter((player) => ids.includes(player.id))
      .map((player) => player.name);
    const label =
      ids.length === 1
        ? `Delete "${names[0]}" from the campaign roster?`
        : `Delete ${ids.length} selected players from the campaign roster?`;
    if (
      !window.confirm(
        `${label}\n\nExisting combatants will remain, but their linked race and class information will no longer be available.`,
      )
    )
      return;
    patch(
      "players",
      data.players.filter((player) => !ids.includes(player.id)),
    );
    setSelectedPlayerIds((current) =>
      current.filter((id) => !ids.includes(id)),
    );
    toast.success(
      ids.length === 1 ? "Player deleted" : `${ids.length} players deleted`,
    );
  }
  function togglePlayerSelection(id: string) {
    setSelectedPlayerIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  }
  return (
    <>
      <ScreenTitle
        eyebrow="Reusable party roster"
        title="Campaign players"
        action={
          <div className="flex flex-wrap justify-end gap-2">
            <div className="flex rounded-md border border-white/10 bg-black/20 p-0.5">
              <Button
                size="sm"
                variant="ghost"
                className={
                  viewMode === "cards"
                    ? "bg-amber-300/15 text-amber-200 hover:bg-amber-300/20"
                    : "text-stone-400 hover:bg-white/5"
                }
                onClick={() => setViewMode("cards")}
              >
                Cards
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className={
                  viewMode === "list"
                    ? "bg-amber-300/15 text-amber-200 hover:bg-amber-300/20"
                    : "text-stone-400 hover:bg-white/5"
                }
                onClick={() => setViewMode("list")}
              >
                List
              </Button>
            </div>
            <Button
              onClick={add}
              className="bg-amber-300 text-black hover:bg-amber-200"
            >
              <Plus /> Add player
            </Button>
          </div>
        }
      />
      <p className="mb-5 max-w-2xl text-sm leading-relaxed text-stone-400">
        Save the party once, then add these players to any encounter from the
        Combat menu. HP and armor class are optional; unset values default to 10
        when added to combat.
      </p>
      {data.players.length ? (
        viewMode === "cards" ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {data.players.map((player) => (
              <article
                key={player.id}
                className="rounded-xl border border-white/10 bg-[#12161e] p-5"
              >
                <div className="mb-3 flex justify-end">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-stone-600 hover:text-red-300"
                    onClick={() => deletePlayers([player.id])}
                    aria-label={`Delete ${player.name}`}
                  >
                    <Trash2 />
                  </Button>
                </div>
                <PlayerEditor
                  player={player}
                  screenshots={screenshots}
                  upload={upload}
                  update={(part) => update(player.id, part)}
                />
              </article>
            ))}
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-white/10 bg-[#12161e]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 p-3">
              <label className="flex items-center gap-2 text-sm text-stone-400">
                <input
                  type="checkbox"
                  className="size-4 accent-amber-300"
                  checked={
                    data.players.length > 0 &&
                    selectedPlayerIds.length === data.players.length
                  }
                  onChange={(e) =>
                    setSelectedPlayerIds(
                      e.target.checked
                        ? data.players.map((player) => player.id)
                        : [],
                    )
                  }
                />{" "}
                Select all
              </label>
              <Button
                size="sm"
                variant="outline"
                className="border-red-400/20 bg-red-400/5 text-red-200 hover:bg-red-400/10"
                disabled={!selectedPlayerIds.length}
                onClick={() => deletePlayers(selectedPlayerIds)}
              >
                <Trash2 /> Delete selected ({selectedPlayerIds.length})
              </Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[880px] text-left text-sm">
                <thead className="bg-black/25 text-xs uppercase tracking-wider text-stone-500">
                  <tr>
                    <th className="w-12 px-4 py-3">
                      <span className="sr-only">Select</span>
                    </th>
                    <th className="px-3 py-3">Player</th>
                    <th className="px-3 py-3">Race</th>
                    <th className="px-3 py-3">Class</th>
                    <th className="px-3 py-3 text-right">Level</th>
                    <th className="px-3 py-3 text-right">HP</th>
                    <th className="px-3 py-3 text-right">AC</th>
                    <th className="px-3 py-3">Notes</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {data.players.map((player) => (
                    <tr
                      key={player.id}
                      className={
                        selectedPlayerIds.includes(player.id)
                          ? "bg-amber-300/[.05]"
                          : "hover:bg-white/[.025]"
                      }
                    >
                      <td className="px-4 py-2.5">
                        <input
                          type="checkbox"
                          className="size-4 accent-amber-300"
                          checked={selectedPlayerIds.includes(player.id)}
                          onChange={() => togglePlayerSelection(player.id)}
                          aria-label={`Select ${player.name}`}
                        />
                      </td>
                      <td className="px-3 py-2.5 font-medium text-amber-100">
                        <Dialog>
                          <DialogTrigger asChild>
                            <button className="text-left hover:text-amber-200 hover:underline">
                              {player.name}
                            </button>
                          </DialogTrigger>
                          <DialogContent className="max-h-[88vh] overflow-y-auto border-amber-300/20 bg-[#12161e] text-stone-100 sm:max-w-2xl">
                            <DialogHeader>
                              <DialogTitle className="font-serif text-2xl text-amber-100">
                                Edit campaign player
                              </DialogTitle>
                            </DialogHeader>
                            <PlayerEditor
                              compact
                              player={player}
                              screenshots={screenshots}
                              upload={upload}
                              update={(part) => update(player.id, part)}
                            />
                          </DialogContent>
                        </Dialog>
                      </td>
                      <td className="px-3 py-2.5 text-stone-400">
                        {player.race || "—"}
                      </td>
                      <td className="px-3 py-2.5 text-stone-400">
                        {player.className || "—"}
                      </td>
                      <td className="px-3 py-2.5 text-right text-stone-300">
                        {player.level}
                      </td>
                      <td className="px-3 py-2.5 text-right text-stone-300">
                        {player.hp ?? "—"}
                      </td>
                      <td className="px-3 py-2.5 text-right text-stone-300">
                        {player.ac ?? "—"}
                      </td>
                      <td className="max-w-80 px-3 py-2.5 text-stone-500">
                        {player.notes ? (
                          <NoteContent
                            value={player.notes}
                            screenshots={screenshots}
                          />
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          className="text-stone-600 hover:text-red-300"
                          onClick={() => deletePlayers([player.id])}
                          aria-label={`Delete ${player.name}`}
                        >
                          <Trash2 />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      ) : (
        <div className="rounded-xl border border-dashed border-white/10 bg-[#12161e]/50 p-10 text-center">
          <Users className="mx-auto text-stone-600" />
          <h2 className="mt-3 font-serif text-xl text-stone-300">
            No campaign players yet
          </h2>
          <p className="mt-2 text-sm text-stone-500">
            Add the party here to reuse their details across encounters.
          </p>
        </div>
      )}
    </>
  );
}
