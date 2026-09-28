"use client";

import { ChevronRight, Play, Plus, Swords, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createId } from "@/features/campaign/id";
import type { Monster, PreparedEncounter, PreparedEncounterMonster, SessionNote } from "@/features/campaign/types";
import { addPreparedMonster, createPreparedEncounter } from "./domain";

export function PreparedEncounters({
  session,
  monsters,
  updateSession,
  loadEncounter,
}: {
  session: SessionNote;
  monsters: Monster[];
  updateSession: (part: Partial<SessionNote>) => void;
  loadEncounter: (encounter: PreparedEncounter) => void;
}) {
  function updateEncounter(encounterId: string, part: Partial<PreparedEncounter>) {
    updateSession({ encounters: session.encounters.map((encounter) => encounter.id === encounterId ? { ...encounter, ...part } : encounter) });
  }
  function addEncounter() {
    updateSession({ encounters: [...session.encounters, createPreparedEncounter(session.encounters.length, createId)] });
  }
  function deleteEncounter(encounter: PreparedEncounter) {
    if (!window.confirm(`Delete prepared encounter "${encounter.name}"?`)) return;
    updateSession({ encounters: session.encounters.filter((item) => item.id !== encounter.id) });
    toast.success("Prepared encounter deleted");
  }
  function addMonster(encounter: PreparedEncounter, monsterId: string) {
    if (!monsterId) return;
    updateEncounter(encounter.id, { monsters: [...encounter.monsters, addPreparedMonster(encounter, monsterId, createId)] });
  }
  function updateMonster(encounter: PreparedEncounter, entryId: string, part: Partial<PreparedEncounterMonster>) {
    updateEncounter(encounter.id, { monsters: encounter.monsters.map((entry) => entry.id === entryId ? { ...entry, ...part } : entry) });
  }
  function removeMonster(encounter: PreparedEncounter, entryId: string) {
    updateEncounter(encounter.id, { monsters: encounter.monsters.filter((entry) => entry.id !== entryId) });
  }

  return (
    <details className="group mt-5 border-t border-white/10 pt-5">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-lg px-2 py-1 transition hover:bg-white/[.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/60">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[.18em] text-amber-300/70">Prepared combat</p>
          <h3 className="mt-1 flex items-center gap-2 font-serif text-xl text-stone-200">
            Encounters <span className="rounded-full border border-white/10 bg-black/20 px-2 py-0.5 font-sans text-xs text-stone-400">{session.encounters.length}</span>
          </h3>
        </div>
        <ChevronRight className="text-stone-500 transition-transform group-open:rotate-90" />
      </summary>
      <div className="pt-4">
        <div className="flex justify-end">
          <Button size="sm" variant="outline" className="border-white/15 bg-transparent hover:bg-white/5" onClick={addEncounter}><Plus /> Add encounter</Button>
        </div>
        {session.encounters.length ? (
          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            {session.encounters.map((encounter) => (
              <article key={encounter.id} className="rounded-xl border border-white/10 bg-black/20 p-4">
                <div className="flex items-start gap-2">
                  <Input aria-label="Encounter name" className="border-white/10 bg-[#12161e] font-serif text-lg text-amber-100" value={encounter.name} onChange={(event) => updateEncounter(encounter.id, { name: event.target.value })} />
                  <Button size="icon" variant="ghost" className="shrink-0 text-stone-600 hover:text-red-300" onClick={() => deleteEncounter(encounter)} aria-label={`Delete ${encounter.name}`}><Trash2 /></Button>
                </div>
                <div className="mt-3 flex gap-2">
                  <select aria-label={`Add monster to ${encounter.name}`} value="" onChange={(event) => addMonster(encounter, event.target.value)} className="h-9 min-w-0 flex-1 rounded-md border border-white/10 bg-[#12161e] px-3 text-sm text-stone-300">
                    <option value="">Add a Bestiary monster…</option>
                    {monsters.map((monster) => <option key={monster.id} value={monster.id}>{monster.name} · CR {monster.cr}</option>)}
                  </select>
                </div>
                {encounter.monsters.length ? (
                  <div className="mt-3 space-y-2">
                    {encounter.monsters.map((reference) => {
                      const monster = monsters.find((entry) => entry.id === reference.monsterId);
                      return (
                        <div key={reference.id} className="flex items-center gap-3 rounded-lg border border-white/10 bg-[#12161e] px-3 py-2">
                          <label className="w-16 shrink-0">
                            <span className="sr-only">Monster number</span>
                            <Input aria-label={`${monster?.name ?? "Monster"} number`} className="h-8 border-white/10 bg-black/20 px-1 text-center text-sm text-red-200" type="number" min="1" placeholder="#" value={reference.number ?? ""} onChange={(event) => updateMonster(encounter, reference.id, { number: event.target.value === "" ? null : Math.max(1, +event.target.value) })} />
                          </label>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-stone-200">{monster?.name ?? "Missing Bestiary monster"}{reference.number != null ? ` #${reference.number}` : ""}</p>
                            <p className="text-xs text-stone-500">{monster ? `CR ${monster.cr} · HP ${monster.hp} · AC ${monster.ac}` : "This monster was removed from the Bestiary."}</p>
                          </div>
                          <Button size="icon-sm" variant="ghost" className="text-stone-600 hover:text-red-300" onClick={() => removeMonster(encounter, reference.id)} aria-label={`Remove ${monster?.name ?? "monster"}`}><X /></Button>
                        </div>
                      );
                    })}
                  </div>
                ) : <p className="mt-3 rounded-lg border border-dashed border-white/10 p-4 text-center text-xs text-stone-600">No monsters prepared yet.</p>}
                <Button className="mt-4 w-full bg-amber-300 text-black hover:bg-amber-200" disabled={!encounter.monsters.some((reference) => monsters.some((monster) => monster.id === reference.monsterId))} onClick={() => loadEncounter(encounter)}><Play /> Load in Combat</Button>
              </article>
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-dashed border-white/10 p-6 text-center">
            <Swords className="mx-auto text-stone-600" /><p className="mt-2 text-sm text-stone-500">Prepare one or more encounters for this session.</p>
          </div>
        )}
      </div>
    </details>
  );
}
