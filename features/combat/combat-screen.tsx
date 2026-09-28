"use client";

import { useState } from "react";
import { ChevronRight, Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { createId } from "@/features/campaign/id";
import type { CampaignPatch, CampaignState, Combatant } from "@/features/campaign/types";
import { ScreenTitle } from "@/features/shared/ui";
import { useScreenshotLibrary } from "@/features/screenshots/use-screenshot-library";
import { createMonsterCombatants, createPlayerCombatants, turnAfterRemovingMonsters } from "./domain";
import { BestiaryMonsterPicker, CampaignPlayerPicker } from "./combatant-pickers";
import { InitiativeList } from "./initiative-list";
import { CombatantPanel } from "./combatant-panel";

export function Combat({
  data,
  ordered,
  update,
  patch,
  advance,
}: {
  data: CampaignState;
  ordered: Combatant[];
  update: (id: string, part: Partial<Combatant>) => void;
  patch: CampaignPatch;
  advance: () => string | undefined;
}) {
  const { screenshots } = useScreenshotLibrary();
  const [selectedId, setSelectedId] = useState(ordered[0]?.id ?? "");
  const [playerPickerOpen, setPlayerPickerOpen] = useState(false);
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
  const [bestiaryPickerOpen, setBestiaryPickerOpen] = useState(false);
  const [bestiarySearch, setBestiarySearch] = useState("");
  const [selectedMonsterIds, setSelectedMonsterIds] = useState<string[]>([]);
  const active = ordered[data.turn];
  const selected = ordered.find((combatant) => combatant.id === selectedId) ?? ordered[0];
  const monster = data.monsters.find((entry) => entry.id === selected?.monsterId);
  const selectedPlayer = data.players.find((player) => player.id === selected?.campaignPlayerId);
  const hasStandingCombatant = ordered.some((combatant) => combatant.hp > 0);

  function advanceAndFocus() {
    const nextCombatantId = advance();
    if (nextCombatantId) setSelectedId(nextCombatantId);
  }
  function add() {
    const id = createId();
    patch("combatants", [...data.combatants, { id, name: "New combatant", kind: "monster", initiative: 10, hp: 10, maxHp: 10, ac: 10, conditions: [] }]);
    setSelectedId(id);
  }
  function addCampaignPlayers() {
    const additions = createPlayerCombatants(data.players, selectedPlayerIds, data.combatants, createId);
    if (!additions.length) return;
    patch("combatants", [...data.combatants, ...additions]);
    setSelectedId(additions.at(-1)?.id ?? "");
    setSelectedPlayerIds([]);
    setPlayerPickerOpen(false);
    toast.success(`${additions.length} ${additions.length === 1 ? "player" : "players"} added to combat`);
  }
  function addBestiaryMonsters() {
    const additions = createMonsterCombatants(data.monsters, selectedMonsterIds, data.combatants, createId);
    if (!additions.length) return;
    patch("combatants", [...data.combatants, ...additions]);
    setSelectedId(additions.at(-1)?.id ?? "");
    setSelectedMonsterIds([]);
    setBestiarySearch("");
    setBestiaryPickerOpen(false);
    toast.success(`${additions.length} ${additions.length === 1 ? "monster" : "monsters"} added to combat`);
  }
  function resetRounds() {
    patch("round", 1);
    patch("turn", Math.max(0, ordered.findIndex((combatant) => combatant.hp > 0)));
    toast.success("Rounds reset");
  }
  function clearMonsters() {
    const monsters = ordered.filter((combatant) => combatant.kind === "monster");
    if (!monsters.length || !window.confirm(`Remove ${monsters.length === 1 ? "the monster combatant" : `all ${monsters.length} monster combatants`} from the tracker? Players and NPCs will remain.`)) return;
    const survivors = ordered.filter((combatant) => combatant.kind !== "monster");
    patch("combatants", data.combatants.filter((combatant) => combatant.kind !== "monster"));
    patch("turn", turnAfterRemovingMonsters(ordered, data.turn));
    if (selected?.kind === "monster") setSelectedId(survivors[0]?.id ?? "");
    toast.success(monsters.length === 1 ? "Monster removed" : "Monster combatants removed");
  }
  function clearCombat() {
    if (!window.confirm("Clear every combatant from the tracker? This cannot be undone.")) return;
    patch("combatants", []);
    patch("round", 1);
    patch("turn", 0);
    setSelectedId("");
    toast.success("Combat tracker cleared");
  }
  function renameEncounter() {
    const name = window.prompt("Enter a name for this encounter:", data.encounterName)?.trim();
    if (name && name !== data.encounterName) {
      patch("encounterName", name);
      toast.success("Encounter renamed");
    }
  }
  function removeSelected() {
    if (!selected) return;
    patch("combatants", data.combatants.filter((combatant) => combatant.id !== selected.id));
    setSelectedId("");
  }

  return (
    <>
      <ScreenTitle eyebrow="Live encounter" title={data.encounterName} action={<div className="flex flex-wrap justify-end gap-2">
        <Button variant="outline" className="border-white/15 bg-transparent hover:bg-white/5" onClick={renameEncounter}><Pencil /> Rename encounter</Button>
        <CampaignPlayerPicker players={data.players} existingPlayerIds={data.combatants.flatMap((combatant) => combatant.campaignPlayerId ? [combatant.campaignPlayerId] : [])} open={playerPickerOpen} onOpenChange={(open) => { setPlayerPickerOpen(open); if (!open) setSelectedPlayerIds([]); }} selectedIds={selectedPlayerIds} setSelectedIds={setSelectedPlayerIds} onAdd={addCampaignPlayers} />
        <BestiaryMonsterPicker monsters={data.monsters} open={bestiaryPickerOpen} onOpenChange={(open) => { setBestiaryPickerOpen(open); if (!open) { setBestiarySearch(""); setSelectedMonsterIds([]); } }} search={bestiarySearch} setSearch={setBestiarySearch} selectedIds={selectedMonsterIds} setSelectedIds={setSelectedMonsterIds} onAdd={addBestiaryMonsters} />
        <Button onClick={add} className="bg-amber-300 text-black hover:bg-amber-200"><Plus /> Add combatant</Button>
      </div>} />
      <div className="mb-5 flex flex-wrap items-center gap-4 rounded-xl border border-amber-300/20 bg-amber-300/5 p-4">
        <div><p className="text-xs uppercase tracking-wider text-stone-500">Round</p><p className="font-serif text-2xl text-amber-200">{data.round}</p></div>
        <div className="h-9 w-px bg-white/10" />
        <div className="min-w-0 flex-1"><p className="text-xs uppercase tracking-wider text-stone-500">Current turn</p><p className={`truncate font-medium ${active?.hp === 0 ? "text-red-300" : ""}`}>{active ? `${active.name}${active.kind !== "player" && active.number != null ? ` #${active.number}` : ""}` : "No combatants"}{active?.hp === 0 ? " — Down" : ""}</p></div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="border-white/10 bg-transparent text-stone-300 hover:bg-white/5" onClick={resetRounds}><RotateCcw /> Reset rounds</Button>
          <Button variant="outline" className="border-white/10 bg-transparent text-stone-300 hover:bg-white/5" disabled={!ordered.some((combatant) => combatant.kind === "monster")} onClick={clearMonsters}><Trash2 /> Clear monsters</Button>
          <Button variant="outline" className="border-red-400/20 bg-red-400/5 text-red-200 hover:bg-red-400/10" onClick={clearCombat}><Trash2 /> Clear combat</Button>
          <Button disabled={!hasStandingCombatant} onClick={advanceAndFocus} className="bg-[#d75b42] hover:bg-[#ec6b50] disabled:bg-stone-700">Next turn <ChevronRight /></Button>
        </div>
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,3fr)_minmax(0,7fr)]">
        <InitiativeList combatants={ordered} players={data.players} turn={data.turn} selectedId={selected?.id} select={setSelectedId} />
        <CombatantPanel combatant={selected} player={selectedPlayer} monster={monster} screenshots={screenshots} update={(part) => selected && update(selected.id, part)} remove={removeSelected} />
      </div>
    </>
  );
}
