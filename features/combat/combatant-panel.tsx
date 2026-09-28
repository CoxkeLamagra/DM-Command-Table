"use client";

import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { CampaignPlayer, Combatant, Monster } from "@/features/campaign/types";
import type { Screenshot } from "@/lib/api/screenshot-client";
import { ConditionEditor, HitPointEditor, MonsterStatBlock } from "./combatant-details";

export function CombatantPanel({
  combatant,
  player,
  monster,
  screenshots,
  update,
  remove,
}: {
  combatant: Combatant | undefined;
  player: CampaignPlayer | undefined;
  monster: Monster | undefined;
  screenshots: Screenshot[];
  update: (part: Partial<Combatant>) => void;
  remove: () => void;
}) {
  return (
    <aside className="rounded-xl border border-white/10 bg-[#12161e] p-5 xl:sticky xl:top-20 xl:self-start">
      {combatant ? (
        <>
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1"><div className="flex gap-2">
              <label className="group relative min-w-0 flex-1"><span className="sr-only">Combatant name</span><Input className="h-11 border-white/10 bg-black/20 pr-10 font-serif text-xl text-amber-100" value={combatant.name} onFocus={(event) => event.currentTarget.select()} onChange={(event) => update({ name: event.target.value })} /><Pencil className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-stone-500" /></label>
              {combatant.kind !== "player" && <label className="w-24 shrink-0"><span className="sr-only">Combatant number</span><Input aria-label="Combatant number" className="h-11 border-white/10 bg-black/20 text-center font-serif text-lg text-amber-100" type="number" min="1" placeholder="#" value={combatant.number ?? ""} onChange={(event) => update({ number: event.target.value === "" ? null : Math.max(1, +event.target.value) })} /></label>}
            </div></div>
            <Button size="icon" variant="ghost" className="text-stone-600 hover:text-red-300" onClick={remove}><Trash2 /></Button>
          </div>
          {player && (player.race || player.className) && <p className="mt-3 text-sm text-stone-400">{[player.race, player.className].filter(Boolean).join(" · ")}</p>}
          <div className="mt-4 grid grid-cols-3 gap-3">
            <label className="text-xs text-stone-500">Type<select className="mt-1 h-10 w-full rounded-md border border-white/10 bg-black/25 px-2 font-medium text-stone-200 outline-none transition focus:border-amber-300/50 focus:ring-2 focus:ring-amber-300/10" value={combatant.kind} onChange={(event) => update({ kind: event.target.value as Combatant["kind"] })}><option className="bg-[#12161e] text-stone-200" value="monster">Monster</option><option className="bg-[#12161e] text-stone-200" value="player">Player</option><option className="bg-[#12161e] text-stone-200" value="npc">NPC</option></select></label>
            <label className="text-xs text-stone-500">Initiative<Input className="mt-1 border-white/10 bg-black/20" type="number" value={combatant.initiative} onChange={(event) => update({ initiative: +event.target.value })} /></label>
            <label className="text-xs text-stone-500">Armor class<Input className="mt-1 border-white/10 bg-black/20" type="number" value={combatant.ac} onChange={(event) => update({ ac: +event.target.value })} /></label>
          </div>
          <HitPointEditor combatant={combatant} update={update} />
          <ConditionEditor key={combatant.id} combatant={combatant} update={update} />
          <MonsterStatBlock monster={monster} screenshots={screenshots} />
        </>
      ) : <div className="grid min-h-72 place-items-center text-stone-500">Select a combatant to view details.</div>}
    </aside>
  );
}
