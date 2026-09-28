"use client";

import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { richTextToPlainText } from "@/features/rich-text/rich-text";
import { Stat } from "@/features/shared/ui";
import type { Monster } from "@/features/campaign/types";
import { MonsterDialog } from "./monster-dialog";

type BestiaryViewProps = {
  monsters: Monster[];
  update: (id: string, part: Partial<Monster>) => void;
  deleteMonsters: (ids: string[]) => void;
};

export function BestiaryCards({ monsters, update, deleteMonsters }: BestiaryViewProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {monsters.map((monster) => (
        <div key={monster.id} className="rounded-xl border border-white/10 bg-[#12161e] p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="truncate font-serif text-2xl text-amber-100">{monster.name}</h2>
              <p className="mt-1 text-sm italic text-stone-500">
                {monster.type} · CR {monster.cr}{monster.source ? ` · ${monster.source}` : ""}
              </p>
            </div>
            <div className="flex shrink-0 gap-1">
              <MonsterDialog monster={monster} update={(part) => update(monster.id, part)} trigger={<Button size="sm" variant="outline" className="border-white/10">Open</Button>} />
              <Button size="icon-sm" variant="ghost" className="text-stone-600 hover:text-red-300" onClick={() => deleteMonsters([monster.id])} aria-label={`Delete ${monster.name}`}>
                <Trash2 />
              </Button>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-3 gap-2 text-center">
            <Stat label="Armor" value={monster.ac} />
            <Stat label="Hit points" value={monster.hp} />
            <Stat label="Speed" value={monster.speed} />
          </div>
          <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-stone-400">
            {richTextToPlainText(monster.abilities).split("\n")[0]}
          </p>
        </div>
      ))}
    </div>
  );
}

export function BestiaryList({
  monsters,
  update,
  deleteMonsters,
  selectedIds,
  setSelectedIds,
}: BestiaryViewProps & {
  selectedIds: string[];
  setSelectedIds: (ids: string[]) => void;
}) {
  function toggle(id: string) {
    setSelectedIds(selectedIds.includes(id) ? selectedIds.filter((item) => item !== id) : [...selectedIds, id]);
  }

  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-[#12161e]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 p-3">
        <label className="flex items-center gap-2 text-sm text-stone-400">
          <input type="checkbox" className="size-4 accent-amber-300" checked={monsters.length > 0 && selectedIds.length === monsters.length} onChange={(event) => setSelectedIds(event.target.checked ? monsters.map((monster) => monster.id) : [])} />
          Select all
        </label>
        <Button size="sm" variant="outline" className="border-red-400/20 bg-red-400/5 text-red-200 hover:bg-red-400/10" disabled={!selectedIds.length} onClick={() => deleteMonsters(selectedIds)}>
          <Trash2 /> Delete selected ({selectedIds.length})
        </Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-black/25 text-xs uppercase tracking-wider text-stone-500">
            <tr>
              <th className="w-12 px-4 py-3"><span className="sr-only">Select</span></th>
              <th className="px-3 py-3">Monster</th><th className="px-3 py-3">Type</th><th className="px-3 py-3">CR</th>
              <th className="px-3 py-3 text-right">AC</th><th className="px-3 py-3 text-right">HP</th>
              <th className="px-3 py-3">Speed</th><th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {monsters.map((monster) => (
              <tr key={monster.id} className={selectedIds.includes(monster.id) ? "bg-amber-300/[.05]" : "hover:bg-white/[.025]"}>
                <td className="px-4 py-2.5"><input type="checkbox" className="size-4 accent-amber-300" checked={selectedIds.includes(monster.id)} onChange={() => toggle(monster.id)} aria-label={`Select ${monster.name}`} /></td>
                <td className="px-3 py-2.5">
                  <MonsterDialog monster={monster} update={(part) => update(monster.id, part)} trigger={<button className="text-left font-medium text-amber-100 hover:text-amber-200 hover:underline">{monster.name}</button>} />
                  {monster.source && <p className="text-xs text-stone-600">{monster.source}</p>}
                </td>
                <td className="px-3 py-2.5 text-stone-400">{monster.type}</td><td className="px-3 py-2.5 text-stone-300">{monster.cr}</td>
                <td className="px-3 py-2.5 text-right text-stone-300">{monster.ac}</td><td className="px-3 py-2.5 text-right text-stone-300">{monster.hp}</td>
                <td className="px-3 py-2.5 text-stone-400">{monster.speed}</td>
                <td className="px-4 py-2.5"><div className="flex justify-end gap-1">
                  <MonsterDialog monster={monster} update={(part) => update(monster.id, part)} trigger={<Button size="sm" variant="outline" className="border-white/10">Open</Button>} />
                  <Button size="icon-sm" variant="ghost" className="text-stone-600 hover:text-red-300" onClick={() => deleteMonsters([monster.id])} aria-label={`Delete ${monster.name}`}><Trash2 /></Button>
                </div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
