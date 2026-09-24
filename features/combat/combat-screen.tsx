"use client";

import { useState } from "react";
import {
  ChevronRight,
  Minus,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { createId } from "@/features/campaign/id";
import type {
  CampaignPatch,
  CampaignState,
  Combatant,
} from "@/features/campaign/types";
import { DetailSection, ScreenTitle, Stat } from "@/features/shared/ui";
import {
  createMonsterCombatants,
  createPlayerCombatants,
  turnAfterRemovingMonsters,
} from "./domain";
import { BestiaryMonsterPicker, CampaignPlayerPicker } from "./combatant-pickers";

const uid = createId;

export function Combat({
  data,
  ordered,
  update,
  patch,
  advance,
}: {
  data: CampaignState;
  ordered: Combatant[];
  update: (id: string, p: Partial<Combatant>) => void;
  patch: CampaignPatch;
  advance: () => void;
}) {
  const [selectedId, setSelectedId] = useState(ordered[0]?.id ?? "");
  const [newCondition, setNewCondition] = useState("");
  const [playerPickerOpen, setPlayerPickerOpen] = useState(false);
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
  const [bestiaryPickerOpen, setBestiaryPickerOpen] = useState(false);
  const [bestiarySearch, setBestiarySearch] = useState("");
  const [selectedMonsterIds, setSelectedMonsterIds] = useState<string[]>([]);
  const active = ordered[data.turn];
  const selected = ordered.find((c) => c.id === selectedId) ?? ordered[0];
  const monster = data.monsters.find((m) => m.id === selected?.monsterId);
  const selectedPlayer = data.players.find(
    (player) => player.id === selected?.campaignPlayerId,
  );
  const hasStandingCombatant = ordered.some((c) => c.hp > 0);
  const add = () => {
    const id = uid();
    patch("combatants", [
      ...data.combatants,
      {
        id,
        name: "New combatant",
        kind: "monster",
        initiative: 10,
        hp: 10,
        maxHp: 10,
        ac: 10,
        conditions: [],
      },
    ]);
    setSelectedId(id);
  };
  const addCampaignPlayers = () => {
    const additions = createPlayerCombatants(
      data.players,
      selectedPlayerIds,
      uid,
    );
    if (!additions.length) return;
    patch("combatants", [...data.combatants, ...additions]);
    setSelectedId(additions.at(-1)?.id ?? "");
    setSelectedPlayerIds([]);
    setPlayerPickerOpen(false);
    toast.success(
      `${additions.length} ${additions.length === 1 ? "player" : "players"} added to combat`,
    );
  };
  const addBestiaryMonsters = () => {
    const additions = createMonsterCombatants(
      data.monsters,
      selectedMonsterIds,
      data.combatants,
      uid,
    );
    if (!additions.length) return;
    patch("combatants", [...data.combatants, ...additions]);
    setSelectedId(additions.at(-1)?.id ?? "");
    setSelectedMonsterIds([]);
    setBestiarySearch("");
    setBestiaryPickerOpen(false);
    toast.success(
      `${additions.length} ${additions.length === 1 ? "monster" : "monsters"} added to combat`,
    );
  };
  const resetRounds = () => {
    patch("round", 1);
    patch(
      "turn",
      Math.max(
        0,
        ordered.findIndex((combatant) => combatant.hp > 0),
      ),
    );
    toast.success("Rounds reset");
  };
  const clearMonsters = () => {
    const monsters = ordered.filter(
      (combatant) => combatant.kind === "monster",
    );
    if (!monsters.length) return;
    if (
      !window.confirm(
        `Remove ${monsters.length === 1 ? "the monster combatant" : `all ${monsters.length} monster combatants`} from the tracker? Players and NPCs will remain.`,
      )
    )
      return;
    const survivors = ordered.filter(
      (combatant) => combatant.kind !== "monster",
    );
    const nextTurn = turnAfterRemovingMonsters(ordered, data.turn);
    patch(
      "combatants",
      data.combatants.filter((combatant) => combatant.kind !== "monster"),
    );
    patch("turn", nextTurn);
    if (selected?.kind === "monster") setSelectedId(survivors[0]?.id ?? "");
    toast.success(
      monsters.length === 1 ? "Monster removed" : "Monster combatants removed",
    );
  };
  const clearCombat = () => {
    if (
      !window.confirm(
        "Clear every combatant from the tracker? This cannot be undone.",
      )
    )
      return;
    patch("combatants", []);
    patch("round", 1);
    patch("turn", 0);
    setSelectedId("");
    toast.success("Combat tracker cleared");
  };
  const renameEncounter = () => {
    const name = window
      .prompt("Enter a name for this encounter:", data.encounterName)
      ?.trim();
    if (name && name !== data.encounterName) {
      patch("encounterName", name);
      toast.success("Encounter renamed");
    }
  };
  const colors = {
    monster: {
      dot: "bg-red-400",
      border: "border-red-400/45",
      bg: "bg-red-400/[.07]",
      text: "text-red-300",
    },
    player: {
      dot: "bg-emerald-400",
      border: "border-emerald-400/45",
      bg: "bg-emerald-400/[.07]",
      text: "text-emerald-300",
    },
    npc: {
      dot: "bg-sky-400",
      border: "border-sky-400/45",
      bg: "bg-sky-400/[.07]",
      text: "text-sky-300",
    },
  };
  const addCondition = () => {
    const value = newCondition.trim();
    if (value && selected && !selected.conditions.includes(value))
      update(selected.id, { conditions: [...selected.conditions, value] });
    setNewCondition("");
  };
  return (
    <>
      <ScreenTitle
        eyebrow="Live encounter"
        title={data.encounterName}
        action={
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              variant="outline"
              className="border-white/15 bg-transparent hover:bg-white/5"
              onClick={renameEncounter}
            >
              <Pencil /> Rename encounter
            </Button>
            <CampaignPlayerPicker
              players={data.players}
              open={playerPickerOpen}
              onOpenChange={(open) => {
                setPlayerPickerOpen(open);
                if (!open) setSelectedPlayerIds([]);
              }}
              selectedIds={selectedPlayerIds}
              setSelectedIds={setSelectedPlayerIds}
              onAdd={addCampaignPlayers}
            />
            <BestiaryMonsterPicker
              monsters={data.monsters}
              open={bestiaryPickerOpen}
              onOpenChange={(open) => {
                setBestiaryPickerOpen(open);
                if (!open) {
                  setBestiarySearch("");
                  setSelectedMonsterIds([]);
                }
              }}
              search={bestiarySearch}
              setSearch={setBestiarySearch}
              selectedIds={selectedMonsterIds}
              setSelectedIds={setSelectedMonsterIds}
              onAdd={addBestiaryMonsters}
            />
            <Button
              onClick={add}
              className="bg-amber-300 text-black hover:bg-amber-200"
            >
              <Plus /> Add combatant
            </Button>
          </div>
        }
      />
      <div className="mb-5 flex flex-wrap items-center gap-4 rounded-xl border border-amber-300/20 bg-amber-300/5 p-4">
        <div>
          <p className="text-xs uppercase tracking-wider text-stone-500">
            Round
          </p>
          <p className="font-serif text-2xl text-amber-200">{data.round}</p>
        </div>
        <div className="h-9 w-px bg-white/10" />
        <div className="min-w-0 flex-1">
          <p className="text-xs uppercase tracking-wider text-stone-500">
            Current turn
          </p>
          <p
            className={`truncate font-medium ${active?.hp === 0 ? "text-red-300" : ""}`}
          >
            {active
              ? `${active.name}${active.kind !== "player" && active.number != null ? ` #${active.number}` : ""}`
              : "No combatants"}
            {active?.hp === 0 ? " — Down" : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            className="border-white/10 bg-transparent text-stone-300 hover:bg-white/5"
            onClick={resetRounds}
          >
            <RotateCcw /> Reset rounds
          </Button>
          <Button
            variant="outline"
            className="border-white/10 bg-transparent text-stone-300 hover:bg-white/5"
            disabled={
              !ordered.some((combatant) => combatant.kind === "monster")
            }
            onClick={clearMonsters}
          >
            <Trash2 /> Clear monsters
          </Button>
          <Button
            variant="outline"
            className="border-red-400/20 bg-red-400/5 text-red-200 hover:bg-red-400/10"
            onClick={clearCombat}
          >
            <Trash2 /> Clear combat
          </Button>
          <Button
            disabled={!hasStandingCombatant}
            onClick={advance}
            className="bg-[#d75b42] hover:bg-[#ec6b50] disabled:bg-stone-700"
          >
            Next turn <ChevronRight />
          </Button>
        </div>
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(360px,0.9fr)_minmax(420px,1.1fr)]">
        <section className="space-y-2" aria-label="Initiative tracker">
          {ordered.map((c, i) => {
            const tone = colors[c.kind];
            const down = c.hp <= 0;
            const campaignPlayer = data.players.find(
              (player) => player.id === c.campaignPlayerId,
            );
            const playerDetails = [
              campaignPlayer?.race,
              campaignPlayer?.className,
            ]
              .filter(Boolean)
              .join(" · ");
            return (
              <button
                key={c.id}
                onClick={() => setSelectedId(c.id)}
                className={`grid w-full grid-cols-[44px_1fr_auto] items-center gap-3 rounded-xl border p-3 text-left transition ${down ? "border-red-500/50 bg-red-950/20" : selected?.id === c.id ? `${tone.border} ${tone.bg}` : "border-white/10 bg-[#12161e] hover:border-white/20"} ${selected?.id === c.id && down ? "ring-1 ring-red-400/40" : ""}`}
              >
                <span
                  className={`grid h-10 w-10 place-items-center rounded-full bg-black/25 font-serif text-lg ${down ? "text-red-300" : tone.text}`}
                >
                  {c.initiative}
                </span>
                <span className="min-w-0">
                  <span className="flex items-center gap-2">
                    <span
                      className={`h-2.5 w-2.5 rounded-full ${down ? "bg-red-500" : tone.dot}`}
                    />
                    <span
                      className={`truncate font-medium ${down ? "text-stone-400 line-through decoration-red-400/70" : ""}`}
                    >
                      {c.name}
                      {c.kind !== "player" && c.number != null
                        ? ` #${c.number}`
                        : ""}
                    </span>
                    {down && (
                      <Badge className="border border-red-400/30 bg-red-500/15 text-red-200">
                        Down · 0 HP
                      </Badge>
                    )}
                    {i === data.turn && (
                      <Badge className="bg-amber-300/15 text-amber-200">
                        Turn
                      </Badge>
                    )}
                  </span>
                  <span className="mt-1 block truncate text-xs text-stone-500">
                    {playerDetails ? `${playerDetails} · ` : ""}
                    {c.kind.charAt(0).toUpperCase() + c.kind.slice(1)} · AC{" "}
                    {c.ac}
                    {c.conditions.length ? ` · ${c.conditions.join(", ")}` : ""}
                  </span>
                </span>
                <span className="text-right text-xs">
                  <span
                    className={`block ${down ? "font-semibold text-red-300" : "text-stone-300"}`}
                  >
                    {c.hp}/{c.maxHp} HP
                  </span>
                  <Progress
                    value={Math.max(0, (c.hp / c.maxHp) * 100)}
                    className="mt-2 h-1.5 w-20 bg-white/10"
                  />
                </span>
              </button>
            );
          })}
        </section>
        <aside className="rounded-xl border border-white/10 bg-[#12161e] p-5 xl:sticky xl:top-20 xl:self-start">
          {selected ? (
            <>
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex gap-2">
                    <label className="group relative min-w-0 flex-1">
                      <span className="sr-only">Combatant name</span>
                      <Input
                        className="h-11 border-white/10 bg-black/20 pr-10 font-serif text-xl text-amber-100"
                        value={selected.name}
                        onFocus={(e) => e.currentTarget.select()}
                        onChange={(e) =>
                          update(selected.id, { name: e.target.value })
                        }
                      />
                      <Pencil className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-stone-500" />
                    </label>
                    {selected.kind !== "player" && (
                      <label className="w-24 shrink-0">
                        <span className="sr-only">Combatant number</span>
                        <Input
                          aria-label="Combatant number"
                          className="h-11 border-white/10 bg-black/20 text-center font-serif text-lg text-amber-100"
                          type="number"
                          min="1"
                          placeholder="#"
                          value={selected.number ?? ""}
                          onChange={(e) =>
                            update(selected.id, {
                              number:
                                e.target.value === ""
                                  ? null
                                  : Math.max(1, +e.target.value),
                            })
                          }
                        />
                      </label>
                    )}
                  </div>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="text-stone-600 hover:text-red-300"
                  onClick={() => {
                    patch(
                      "combatants",
                      data.combatants.filter((x) => x.id !== selected.id),
                    );
                    setSelectedId("");
                  }}
                >
                  <Trash2 />
                </Button>
              </div>
              {selectedPlayer &&
                (selectedPlayer.race || selectedPlayer.className) && (
                  <p className="mt-3 text-sm text-stone-400">
                    {[selectedPlayer.race, selectedPlayer.className]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                )}
              <div className="mt-4 grid grid-cols-3 gap-3">
                <label className="text-xs text-stone-500">
                  Type
                  <select
                    className="mt-1 h-10 w-full rounded-md border border-white/10 bg-black/25 px-2 font-medium text-stone-200 outline-none transition focus:border-amber-300/50 focus:ring-2 focus:ring-amber-300/10"
                    value={selected.kind}
                    onChange={(e) =>
                      update(selected.id, {
                        kind: e.target.value as Combatant["kind"],
                      })
                    }
                  >
                    <option
                      className="bg-[#12161e] text-stone-200"
                      value="monster"
                    >
                      Monster
                    </option>
                    <option
                      className="bg-[#12161e] text-stone-200"
                      value="player"
                    >
                      Player
                    </option>
                    <option className="bg-[#12161e] text-stone-200" value="npc">
                      NPC
                    </option>
                  </select>
                </label>
                <label className="text-xs text-stone-500">
                  Initiative
                  <Input
                    className="mt-1 border-white/10 bg-black/20"
                    type="number"
                    value={selected.initiative}
                    onChange={(e) =>
                      update(selected.id, { initiative: +e.target.value })
                    }
                  />
                </label>
                <label className="text-xs text-stone-500">
                  Armor class
                  <Input
                    className="mt-1 border-white/10 bg-black/20"
                    type="number"
                    value={selected.ac}
                    onChange={(e) =>
                      update(selected.id, { ac: +e.target.value })
                    }
                  />
                </label>
              </div>
              <div className="mt-5">
                <div className="mb-2 flex justify-between text-sm">
                  <span className="text-stone-400">Hit points</span>
                  <span>
                    {selected.hp} / {selected.maxHp}
                  </span>
                </div>
                <Progress
                  value={Math.max(0, (selected.hp / selected.maxHp) * 100)}
                  className="h-2.5 bg-white/10"
                />
                <div className="mt-3 flex items-center gap-2">
                  <Button
                    size="icon"
                    variant="outline"
                    className="border-white/10"
                    onClick={() =>
                      update(selected.id, { hp: Math.max(0, selected.hp - 1) })
                    }
                  >
                    <Minus />
                  </Button>
                  <Input
                    className="w-20 border-white/10 bg-black/20 text-center"
                    type="number"
                    value={selected.hp}
                    onChange={(e) =>
                      update(selected.id, { hp: +e.target.value })
                    }
                  />
                  <span className="text-stone-600">/</span>
                  <Input
                    aria-label="Maximum hit points"
                    className="w-20 border-white/10 bg-black/20 text-center"
                    type="number"
                    value={selected.maxHp}
                    onChange={(e) =>
                      update(selected.id, { maxHp: +e.target.value })
                    }
                  />
                  <Button
                    size="icon"
                    variant="outline"
                    className="border-white/10"
                    onClick={() =>
                      update(selected.id, {
                        hp: Math.min(selected.maxHp, selected.hp + 1),
                      })
                    }
                  >
                    <Plus />
                  </Button>
                </div>
              </div>
              <section className="mt-6 border-t border-white/10 pt-5">
                <h3 className="font-serif text-lg text-amber-200">
                  Status conditions
                </h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  {selected.conditions.length ? (
                    selected.conditions.map((condition) => (
                      <Badge
                        key={condition}
                        className="gap-1 bg-violet-400/15 py-1.5 text-violet-200"
                      >
                        {condition}
                        <button
                          aria-label={`Remove ${condition}`}
                          onClick={() =>
                            update(selected.id, {
                              conditions: selected.conditions.filter(
                                (x) => x !== condition,
                              ),
                            })
                          }
                        >
                          <X size={13} />
                        </button>
                      </Badge>
                    ))
                  ) : (
                    <span className="text-sm text-stone-600">
                      No active conditions
                    </span>
                  )}
                </div>
                <div className="mt-3 flex gap-2">
                  <Input
                    list="condition-options"
                    placeholder="Add a condition…"
                    className="border-white/10 bg-black/20"
                    value={newCondition}
                    onChange={(e) => setNewCondition(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") addCondition();
                    }}
                  />
                  <datalist id="condition-options">
                    {[
                      "Blinded",
                      "Charmed",
                      "Deafened",
                      "Frightened",
                      "Grappled",
                      "Incapacitated",
                      "Invisible",
                      "Paralyzed",
                      "Petrified",
                      "Poisoned",
                      "Prone",
                      "Restrained",
                      "Stunned",
                      "Unconscious",
                      "Concentrating",
                    ].map((x) => (
                      <option key={x} value={x} />
                    ))}
                  </datalist>
                  <Button
                    onClick={addCondition}
                    variant="outline"
                    className="border-white/10"
                  >
                    <Plus /> Add
                  </Button>
                </div>
              </section>
              {monster ? (
                <div className="mt-6 border-t border-white/10 pt-5">
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <h3 className="font-serif text-2xl text-amber-100">
                        {monster.name}
                      </h3>
                      <p className="text-sm italic text-stone-500">
                        {monster.type} · CR {monster.cr}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <Stat label="Armor class" value={monster.ac} />
                    <Stat label="Hit points" value={monster.hp} />
                    <Stat label="Speed" value={monster.speed} />
                  </div>
                  <DetailSection title="Ability scores">
                    {monster.stats}
                  </DetailSection>
                  <DetailSection title="Actions & traits">
                    {monster.abilities}
                  </DetailSection>
                  <DetailSection title="Spellcasting">
                    {monster.spells}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {monster.slots.map((n, i) => (
                        <span
                          key={i}
                          className="rounded-md border border-violet-300/20 bg-violet-300/5 px-2 py-1 text-xs text-violet-200"
                        >
                          Level {i + 1}: {n}
                        </span>
                      ))}
                    </div>
                  </DetailSection>
                </div>
              ) : (
                <div className="mt-6 rounded-lg border border-dashed border-white/10 p-6 text-center text-sm text-stone-500">
                  No bestiary stat block linked to this combatant.
                </div>
              )}
            </>
          ) : (
            <div className="grid min-h-72 place-items-center text-stone-500">
              Select a combatant to view details.
            </div>
          )}
        </aside>
      </div>
    </>
  );
}
