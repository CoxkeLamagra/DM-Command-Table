"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight, Play, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RichTextContent, RichTextEditor } from "@/features/rich-text/rich-text";
import { createPreparedEncounter, deletePreparedEncounter, getV6Combat, listPreparedEncounters, listV6Monsters, saveV6Combat, updatePreparedEncounter, uploadV6Screenshot } from "./api-client";
import type { V6Monster, V6PreparedEncounter } from "./types";

export function PreparedEncounters({ campaignId, sessionId, editable, onOpenCombat }: { campaignId: string; sessionId: string; editable: boolean; onOpenCombat: () => void }) {
  const [items, setItems] = useState<V6PreparedEncounter[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [monsters, setMonsters] = useState<V6Monster[]>([]);
  const [addingTo, setAddingTo] = useState<string>();
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");

  useEffect(() => {
    let live = true;
    void Promise.all([listPreparedEncounters(campaignId, sessionId), listV6Monsters(campaignId)]).then(([value, bestiary]) => {
      if (live) {
        setItems(value);
        setMonsters(bestiary);
        setOpen(value.length > 0);
      }
    }).catch(report);
    return () => { live = false; };
  }, [campaignId, sessionId]);

  function report(reason: unknown) { toast.error(reason instanceof Error ? reason.message : "Encounter update failed."); }
  async function add() {
    setBusy(true); try { const item = await createPreparedEncounter(campaignId, sessionId, items.length); setItems((all) => [...all, item]); setOpen(true); }
    catch (error) { report(error); } finally { setBusy(false); }
  }
  async function save(item: V6PreparedEncounter) {
    setBusy(true); try { const saved = await updatePreparedEncounter(campaignId, item); setItems((all) => all.map((entry) => entry.id === saved.id ? saved : entry)); toast.success("Encounter saved"); }
    catch (error) { report(error); } finally { setBusy(false); }
  }
  async function remove(item: V6PreparedEncounter) {
    if (!window.confirm(`Delete ${item.name}?`)) return;
    setBusy(true); try { await deletePreparedEncounter(campaignId, item); setItems((all) => all.filter(({ id }) => id !== item.id)); }
    catch (error) { report(error); } finally { setBusy(false); }
  }
  function patch(id: string, values: Partial<V6PreparedEncounter>) { setItems((all) => all.map((item) => item.id === id ? { ...item, ...values } : item)); }
  function addChosen() {
    if (!addingTo) return;
    setItems((all) => all.map((item) => {
      if (item.id !== addingTo) return item;
      const additions = [...chosen].map((monsterId, offset) => {
        const existing = item.monsters.filter((entry) => entry.monsterId === monsterId).map(({ displayNumber }) => displayNumber ?? 0);
        return { id: crypto.randomUUID(), monsterId, displayNumber: Math.max(0, ...existing) + 1, quantity: 1, sortOrder: item.monsters.length + offset };
      });
      return { ...item, monsters: [...item.monsters, ...additions] };
    }));
    setAddingTo(undefined); setChosen(new Set()); setQuery("");
  }
  async function loadInCombat(item: V6PreparedEncounter) {
    if (!window.confirm(`Load "${item.name}" in Combat? Current monsters will be replaced; players and NPCs remain.`)) return;
    setBusy(true);
    try {
      const combat = await getV6Combat(campaignId);
      const survivors = combat.combatants.filter(({ kind }) => kind !== "monster");
      const additions = item.monsters.flatMap((entry) => {
        const monster = monsters.find(({ id }) => id === entry.monsterId); if (!monster) return [];
        return Array.from({ length: entry.quantity }, (_, offset) => ({ id: crypto.randomUUID(), playerId: null, monsterId: monster.id, name: monster.name, displayNumber: (entry.displayNumber ?? 1) + offset, kind: "monster" as const, notes: "", initiative: 10, hitPoints: monster.hitPoints, maximumHitPoints: monster.hitPoints, armorClass: monster.armorClass, sortOrder: survivors.length + offset, conditions: [], revision: 1 }));
      });
      await saveV6Combat(campaignId, { ...combat, name: item.name || "Prepared encounter", round: 1, turn: 0, combatants: [...survivors, ...additions] }, "prepared_encounter_loaded");
      toast.success("Prepared encounter loaded"); onOpenCombat();
    } catch (error) { report(error); } finally { setBusy(false); }
  }

  return <div className="mt-5 border-t border-white/10 pt-4">
    <div className="flex items-center justify-between">
      <button type="button" aria-expanded={open} className="flex items-center gap-2 text-sm font-medium" onClick={() => setOpen((value) => !value)}>{open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />} Prepared encounters ({items.length})</button>
      {editable && <Button size="sm" variant="outline" disabled={busy} onClick={add}><Plus /> Encounter</Button>}
    </div>
    {open && <div className="mt-3 space-y-3">{items.length === 0 ? <p className="rounded-lg border border-dashed border-white/10 p-4 text-sm text-stone-600">No encounters prepared yet.</p> : items.map((item) => <div key={item.id} className="rounded-lg border border-white/10 bg-black/20 p-4">
      <div className="flex gap-2"><Input value={item.name} disabled={!editable} onChange={(event) => patch(item.id, { name: event.target.value })} /><Button size="icon" variant="ghost" disabled={!editable || busy} onClick={() => save(item)}><Save /></Button><Button size="icon" variant="ghost" disabled={!editable || busy} onClick={() => remove(item)}><Trash2 /></Button></div>
      <div className="mt-3">{editable ? <RichTextEditor value={item.notes} onChange={(notes) => patch(item.id, { notes })} onPasteImage={uploadV6Screenshot} placeholder="Encounter tactics and notes…" className="min-h-24" /> : <RichTextContent value={item.notes} />}</div>
      <div className="mt-3 flex items-center justify-between"><p className="text-xs font-medium uppercase tracking-wider text-stone-500">Monsters ({item.monsters.length})</p>{editable && <Button size="sm" variant="outline" onClick={() => setAddingTo(item.id)}><Plus /> Add monsters</Button>}</div>
      <div className="mt-2 space-y-1">{item.monsters.map((entry) => { const monster = monsters.find(({ id }) => id === entry.monsterId); return <div key={entry.id} className="flex items-center gap-2 rounded bg-white/5 px-3 py-2 text-sm"><span className="min-w-0 flex-1 truncate">{monster?.name ?? "Missing monster"}{entry.displayNumber ? ` #${entry.displayNumber}` : ""}</span><span className="text-xs text-stone-500">× {entry.quantity}</span>{editable && <Button size="icon-xs" variant="ghost" onClick={() => patch(item.id, { monsters: item.monsters.filter(({ id }) => id !== entry.id) })}><Trash2 /></Button>}</div>; })}</div>
      {editable && <Button className="mt-3 w-full" disabled={!item.monsters.length || busy} onClick={() => loadInCombat(item)}><Play /> Load in Combat</Button>}
    </div>)}</div>}
    <Dialog open={!!addingTo} onOpenChange={(value) => { if (!value) { setAddingTo(undefined); setChosen(new Set()); } }}><DialogContent className="border-white/10 bg-[#151820] text-stone-100"><DialogHeader><DialogTitle>Add bestiary monsters</DialogTitle></DialogHeader><Input type="search" placeholder="Search by name, type, or CR…" value={query} onChange={(event) => setQuery(event.target.value)} /><div className="max-h-72 space-y-1 overflow-y-auto">{monsters.filter((monster) => `${monster.name} ${monster.type} ${monster.challengeRating}`.toLowerCase().includes(query.toLowerCase())).map((monster) => <label key={monster.id} className="flex cursor-pointer items-center gap-3 rounded px-3 py-2 hover:bg-white/5"><Checkbox checked={chosen.has(monster.id)} onCheckedChange={(checked) => setChosen((current) => { const next = new Set(current); if (checked) next.add(monster.id); else next.delete(monster.id); return next; })} /><span className="flex-1">{monster.name}</span><span className="text-xs text-stone-500">{monster.type} · CR {monster.challengeRating}</span></label>)}</div><Button disabled={!chosen.size} onClick={addChosen}>Add selected ({chosen.size})</Button></DialogContent></Dialog>
  </div>;
}
