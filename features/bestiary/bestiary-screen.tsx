"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { createId } from "@/features/campaign/id";
import type { CampaignPatch, CampaignState, Monster } from "@/features/campaign/types";
import { ScreenTitle } from "@/features/shared/ui";
import { BestiaryImportDialog } from "./bestiary-import-dialog";
import { BestiaryCards, BestiaryList } from "./bestiary-views";

export function Bestiary({ data, patch }: { data: CampaignState; patch: CampaignPatch }) {
  const [viewMode, setViewMode] = useState<"cards" | "list">("list");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  function update(id: string, part: Partial<Monster>) {
    patch("monsters", data.monsters.map((monster) => monster.id === id ? { ...monster, ...part } : monster));
  }

  function add() {
    const name = window.prompt("Enter a name for the new monster:", "")?.trim();
    if (!name) return;
    patch("monsters", [...data.monsters, {
      id: createId(), name, type: "Medium creature", cr: "1", ac: 12, hp: 20,
      speed: "30 ft.", stats: "STR 10  DEX 10  CON 10  INT 10  WIS 10  CHA 10",
      abilities: "Add actions and abilities here.", spells: "No spells", notes: "",
      slots: [0, 0, 0, 0, 0],
    }]);
  }

  function deleteMonsters(ids: string[]) {
    if (!ids.length) return;
    const names = data.monsters.filter((monster) => ids.includes(monster.id)).map((monster) => monster.name);
    const label = ids.length === 1 ? `Delete "${names[0]}" from the Bestiary?` : `Delete ${ids.length} selected monsters from the Bestiary?`;
    if (!window.confirm(`${label}\n\nExisting combatants will remain, but their linked stat blocks will no longer be available.`)) return;
    patch("monsters", data.monsters.filter((monster) => !ids.includes(monster.id)));
    setSelectedIds((current) => current.filter((id) => !ids.includes(id)));
    toast.success(ids.length === 1 ? "Monster deleted" : `${ids.length} monsters deleted`);
  }

  const viewProps = { monsters: data.monsters, update, deleteMonsters };
  return (
    <>
      <ScreenTitle
        eyebrow="Creature library"
        title="Bestiary"
        action={<div className="flex flex-wrap justify-end gap-2">
          <div className="flex rounded-md border border-white/10 bg-black/20 p-0.5">
            {(["cards", "list"] as const).map((mode) => (
              <Button key={mode} size="sm" variant="ghost" className={viewMode === mode ? "bg-amber-300/15 text-amber-200 hover:bg-amber-300/20" : "text-stone-400 hover:bg-white/5"} onClick={() => setViewMode(mode)}>
                {mode === "cards" ? "Cards" : "List"}
              </Button>
            ))}
          </div>
          <BestiaryImportDialog monsters={data.monsters} replaceMonsters={(monsters) => patch("monsters", monsters)} />
          <Button onClick={add} className="bg-amber-300 text-black hover:bg-amber-200"><Plus /> New monster</Button>
        </div>}
      />
      {viewMode === "cards" ? (
        <BestiaryCards {...viewProps} />
      ) : (
        <BestiaryList {...viewProps} selectedIds={selectedIds} setSelectedIds={setSelectedIds} />
      )}
    </>
  );
}
