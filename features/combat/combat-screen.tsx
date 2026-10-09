"use client";
import { DraftAccount, useDraftRecovery } from "../shared/draft-recovery";
import { isDraftDirty } from "@/features/shared/draft-state";

import {
  normalizeCombat,
  takesTurn,
  type ZeroHpPolicy,
} from "../../domain/combat";

import { useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  applyHitPointChange,
  emptyRuntime,
  runtimeForSnapshot,
  snapshotMonster,
} from "@/domain/combat-runtime";
import { SaveStatus } from "@/features/shared/save-status";
import { useUnsavedChanges } from "@/features/shared/unsaved-changes";
import { Tabs } from "radix-ui";
import { DropdownMenu } from "radix-ui";
import { ChevronDown, ChevronRight, Plus, Save, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  CombatantPicker,
  type CombatantSelection,
} from "@/features/shared/combatant-picker";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { ConditionIcon } from "@/features/combat/condition-icons";

import {
  getCombat,
  listMonsters,
  listPlayers,
  saveCombat,
  commandCombat,
  undoCombat,
} from "../shared/api-client";
import type { Combat, Combatant, Monster, Player } from "@/domain/types";

import { CombatantEditor } from "@/features/combat/combatant-editor";
export function CombatScreen({
  campaignId,
  editable,
}: {
  campaignId: string;
  editable: boolean;
}) {
  const userId = useContext(DraftAccount);
  const policyKey = `dmct-turn-policy:${JSON.stringify([userId, campaignId])}`;
  const [zeroHpPolicy, setZeroHpPolicy] = useState<ZeroHpPolicy>(() => {
    try {
      const value = localStorage.getItem(policyKey);
      if (value === "include-players" || value === "include-all") return value;
    } catch {}
    return "skip-all";
  });
  const [combat, setCombat] = useState<Combat | null>(null);
  const [persisted, setPersisted] = useState<Combat | null>(null);
  const pending = useRef(false);
  const [hpUndo, setHpUndo] = useState<{
    id: string;
    before: Pick<Combatant, "hitPoints" | "runtime">;
    after: Pick<Combatant, "hitPoints" | "runtime">;
  } | null>(null);
  const [confirmAction, setConfirmAction] = useState<
    "rounds" | "monsters" | "combat" | null
  >(null);
  const dirty = !!combat && !!persisted && isDraftDirty(combat, persisted);
  useUnsavedChanges(dirty);
  const recovery = useDraftRecovery({
    campaignId,
    scope: "combat",
    value: combat,
    dirty,
    ready: !!persisted && editable,
    restore: (value) => {
      if (
        !value ||
        !Array.isArray(value.combatants) ||
        typeof value.name !== "string" ||
        value.campaignId !== campaignId
      )
        throw new Error("Invalid draft");
      setCombat(normalize(value));
    },
  });
  const [players, setPlayers] = useState<Player[]>([]);
  const [monsters, setMonsters] = useState<Monster[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [mobileView, setMobileView] = useState("initiative");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let live = true;
    void Promise.all([
      getCombat(campaignId),
      listPlayers(campaignId),
      listMonsters(campaignId),
    ])
      .then(([next, campaignPlayers, bestiary]) => {
        if (live) {
          setCombat(normalize(next));
          setPersisted(normalize(next));
          setPlayers(campaignPlayers);
          setMonsters(bestiary);
          setSelectedId(next.combatants[0]?.id ?? "");
        }
      })
      .catch(report);
    return () => {
      live = false;
    };
  }, [campaignId]);
  function report(error: unknown) {
    toast.error(
      error instanceof Error ? error.message : "Combat update failed.",
    );
  }
  const ordered = useMemo(
    () =>
      combat
        ? [...combat.combatants].sort(
            (a, b) => b.initiative - a.initiative || a.sortOrder - b.sortOrder,
          )
        : [],
    [combat],
  );
  const active = ordered[combat?.turn ?? 0];
  const selected =
    ordered.find(({ id }) => id === selectedId) ?? active ?? ordered[0];
  function patchCombat(values: Partial<Combat>) {
    if (pending.current) return;
    setCombat((current) => (current ? { ...current, ...values } : current));
  }
  function patchSelected(values: Partial<Combatant>) {
    if (!selected || pending.current) return;
    setCombat((current) =>
      current
        ? {
            ...current,
            combatants: current.combatants.map((item) =>
              item.id === selected.id ? { ...item, ...values } : item,
            ),
          }
        : current,
    );
  }
  async function persist(
    next: Combat,
    action: string,
    command?: import("../../domain/combat").CombatAction,
  ) {
    if (pending.current) return null;
    pending.current = true;
    setBusy(true);
    try {
      const saved = normalize(
        command
          ? await commandCombat(
              campaignId,
              normalize(next),
              command,
              zeroHpPolicy,
            )
          : await saveCombat(campaignId, normalize(next), action),
      );
      setCombat(saved);
      setPersisted(saved);
      return saved;
    } catch (error) {
      report(error);
      return null;
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  async function save() {
    if (combat && (await persist(combat, "details_updated")))
      toast.success("Combat saved");
  }
  async function nextTurn() {
    if (!combat || !ordered.some((entry) => takesTurn(entry, zeroHpPolicy)))
      return;
    const saved = await persist(combat, "next_turn", "next-turn");
    if (saved) {
      setSelectedId(saved.combatants[saved.turn]?.id ?? "");
      setMobileView("details");
    }
  }

  function adjustHp(amount: number, action: "damage" | "heal") {
    if (!selected || pending.current) return;
    try {
      const before = {
        hitPoints: selected.hitPoints,
        runtime: selected.runtime ?? emptyRuntime(),
      };
      const next = applyHitPointChange(selected, amount, action);
      if (JSON.stringify(next) === JSON.stringify(before)) return;
      setHpUndo({ id: selected.id, before, after: next });
      patchSelected(next);
      if (action === "damage" && before.runtime.concentration)
        toast.info(
          `Concentration check for ${selected.name}: DC ${Math.max(10, Math.floor(amount / 2))}. Resolve manually.`,
        );
    } catch (error) {
      report(error);
    }
  }
  function undoHp() {
    if (!hpUndo || pending.current) return;
    setCombat((current) =>
      current
        ? {
            ...current,
            combatants: current.combatants.map((item) =>
              item.id === hpUndo.id &&
              JSON.stringify({
                hitPoints: item.hitPoints,
                runtime: item.runtime ?? emptyRuntime(),
              }) === JSON.stringify(hpUndo.after)
                ? { ...item, ...hpUndo.before }
                : item,
            ),
          }
        : current,
    );
    setHpUndo(null);
  }
  async function doUndo() {
    if (
      pending.current ||
      (dirty &&
        !window.confirm(
          "Undo the last saved combat change? Your unsaved combat edits will be discarded.",
        ))
    )
      return;
    pending.current = true;
    setBusy(true);
    try {
      const restored = normalize(
        await undoCombat(campaignId, combat?.revision ?? 1),
      );
      setCombat(restored);
      setPersisted(restored);
      setHpUndo(null);
      setSelectedId(
        restored.combatants[restored.turn]?.id ??
          restored.combatants[0]?.id ??
          "",
      );
      toast.success("Last combat change undone");
    } catch (error) {
      report(error);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  async function resetRounds() {
    if (combat) await persist(combat, "rounds_reset", "reset-rounds");
  }
  async function clear(kind?: "monster") {
    if (!combat) return;
    const saved = await persist(
      combat,
      kind ? "monsters_cleared" : "combat_cleared",
      kind ? "remove-monsters" : "clear",
    );
    if (saved) setSelectedId(saved.combatants[0]?.id ?? "");
  }
  async function removeSelected() {
    if (!combat || !selected) return;
    const next = combat.combatants.filter(({ id }) => id !== selected.id);
    const saved = await persist(
      { ...combat, combatants: next, turn: 0 },
      "combatant_removed",
    );
    if (saved) setSelectedId(saved.combatants[0]?.id ?? "");
  }
  function addChosen(selection: CombatantSelection) {
    if (!combat || pending.current) return;
    const additions: Combatant[] = [];
    for (const player of players.filter(
      ({ id }) =>
        selection.playerIds.includes(id) &&
        !combat.combatants.some((item) => item.playerId === id),
    )) {
      const hp = player.hitPoints ?? 10;
      additions.push({
        ...makeCombatant(
          player.name,
          player.kind ?? "player",
          combat.combatants.length + additions.length,
          hp,
          player.armorClass ?? 10,
          player.id,
          null,
          null,
        ),
        notes: player.notes,
      });
    }
    for (const selectedMonster of selection.monsters) {
      const monster = monsters.find(({ id }) => id === selectedMonster.id);
      if (!monster) continue;
      const quantity = selectedMonster.quantity;
      for (let copy = 0; copy < quantity; copy++) {
        const numbers = [...combat.combatants, ...additions]
          .filter((item) => item.monsterId === monster.id)
          .map(({ displayNumber }) => displayNumber ?? 0);
        additions.push(
          makeCombatant(
            monster.name,
            "monster",
            combat.combatants.length + additions.length,
            monster.hitPoints,
            monster.armorClass,
            null,
            monster.id,
            Math.max(0, ...numbers) + 1,
            snapshotMonster(monster),
          ),
        );
      }
    }
    if (selection.singleUse) {
      const value = selection.singleUse;
      const number =
        value.kind === "player"
          ? null
          : Math.max(
              0,
              ...[...combat.combatants, ...additions]
                .filter(
                  (item) =>
                    item.kind === value.kind &&
                    !item.monsterId &&
                    !item.playerId,
                )
                .map((item) => item.displayNumber ?? 0),
            ) + 1;
      additions.push(
        makeCombatant(
          value.name,
          value.kind,
          combat.combatants.length + additions.length,
          value.hitPoints,
          value.armorClass,
          null,
          null,
          number,
        ),
      );
    }
    if (additions.length) {
      setCombat({
        ...combat,
        combatants: [...combat.combatants, ...additions],
      });
      setSelectedId(additions.at(-1)?.id ?? "");
      setMobileView("details");
    }
  }

  if (!combat)
    return (
      <div className="grid min-h-96 place-items-center text-stone-400">
        Loading combat tracker…
      </div>
    );
  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-5">
      {recovery.banner}
      <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">
            Live encounter
          </p>
          <Input
            aria-label="Encounter name"
            className="mt-2 h-11 max-w-md font-serif text-2xl"
            value={combat.name}
            disabled={!editable || busy}
            onChange={(event) => patchCombat({ name: event.target.value })}
          />
        </div>
        {editable && (
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => setPickerOpen(true)}
          >
            <Plus /> Add combatants
          </Button>
        )}
      </header>
      <div
        aria-label="Combat turn controls"
        className="sticky top-16 z-20 flex flex-wrap items-center gap-2 sm:gap-4 rounded-xl border border-amber-300/20 bg-[#17171a]/95 p-4 shadow-lg backdrop-blur lg:top-0"
      >
        <div>
          <p className="text-xs uppercase text-stone-400">Round</p>
          <p className="font-serif text-2xl text-amber-200">{combat.round}</p>
        </div>
        <div className="h-10 w-px bg-white/10" />
        <div className="min-w-0 flex-1">
          <p className="text-xs uppercase text-stone-400">Current turn</p>
          <p className="truncate">
            {active ? displayName(active) : "No combatants"}
          </p>
        </div>
        {editable && (
          <div className="flex flex-wrap gap-2">
            <label className="flex items-center gap-2 text-xs text-stone-300">
              At 0 HP
              <select
                aria-label="Zero HP turn handling"
                disabled={busy}
                value={zeroHpPolicy}
                className="h-9 max-w-48 rounded-md border border-white/10 bg-[#151820] px-2 text-sm"
                onChange={(event) => {
                  const value = event.target.value as ZeroHpPolicy;
                  setZeroHpPolicy(value);
                  try {
                    localStorage.setItem(policyKey, value);
                  } catch {
                    toast.error(
                      "Turn preference could not be remembered in this browser.",
                    );
                  }
                }}
              >
                <option value="skip-all">Skip everyone</option>
                <option value="include-players">Keep Player turns</option>
                <option value="include-all">Keep all turns</option>
              </select>
            </label>
            <Button variant="outline" onClick={doUndo} disabled={busy}>
              <Undo2 /> Undo
            </Button>
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <Button variant="outline" disabled={busy}>
                  Encounter actions <ChevronDown />
                </Button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  align="end"
                  sideOffset={4}
                  className="z-50 min-w-56 rounded-lg border border-white/10 bg-[#151820] p-1 text-stone-100 shadow-lg"
                >
                  <DropdownMenu.Item
                    className="cursor-pointer rounded px-3 py-2 text-sm outline-none data-[highlighted]:bg-white/10"
                    onSelect={() => setConfirmAction("rounds")}
                  >
                    Reset rounds
                  </DropdownMenu.Item>
                  <DropdownMenu.Item
                    className="cursor-pointer rounded px-3 py-2 text-sm outline-none data-[highlighted]:bg-white/10"
                    onSelect={() => setConfirmAction("monsters")}
                  >
                    Clear monsters
                  </DropdownMenu.Item>
                  <DropdownMenu.Item
                    className="cursor-pointer rounded px-3 py-2 text-sm text-red-300 outline-none data-[highlighted]:bg-white/10"
                    onSelect={() => setConfirmAction("combat")}
                  >
                    Clear combat
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
            <SaveStatus dirty={dirty} saving={busy} label="Combat" />
            <Button onClick={save} disabled={busy}>
              <Save /> Save
            </Button>
            <Button
              onClick={nextTurn}
              disabled={
                busy || !ordered.some((entry) => takesTurn(entry, zeroHpPolicy))
              }
              className="bg-[#d75b42] hover:bg-[#ec6b50]"
            >
              Next turn <ChevronRight />
            </Button>
          </div>
        )}
      </div>
      {active && active.hitPoints <= 0 && takesTurn(active, zeroHpPolicy) && (
        <p
          role="status"
          className="rounded-lg border border-violet-400/30 bg-violet-400/10 p-3 text-sm"
        >
          {active.name} is at 0 HP and still has a turn. Check death saves or
          other start-of-turn effects as appropriate; resolve these manually.
        </p>
      )}
      <Tabs.Root value={mobileView} onValueChange={setMobileView}>
        <Tabs.List
          aria-label="Combat view"
          className="mb-4 flex gap-2 rounded-lg bg-white/5 p-1 xl:hidden"
        >
          <Tabs.Trigger
            value="initiative"
            className="flex-1 rounded px-3 py-2 text-sm data-[state=active]:bg-white/10 data-[state=active]:text-amber-200"
          >
            Initiative ({ordered.length})
          </Tabs.Trigger>
          <Tabs.Trigger
            value="details"
            className="flex-1 rounded px-3 py-2 text-sm data-[state=active]:bg-white/10 data-[state=active]:text-amber-200"
          >
            Details
          </Tabs.Trigger>
        </Tabs.List>
        <div className="grid gap-5 xl:grid-cols-[minmax(0,3fr)_minmax(0,7fr)]">
          <Tabs.Content
            value="initiative"
            forceMount
            className="min-w-0 space-y-2 data-[state=inactive]:hidden xl:data-[state=inactive]:block"
          >
            {ordered.map((item, index) => {
              const isSelected = selected?.id === item.id;
              const hpPercent =
                item.maximumHitPoints > 0
                  ? Math.max(
                      0,
                      Math.min(
                        100,
                        (item.hitPoints / item.maximumHitPoints) * 100,
                      ),
                    )
                  : 0;
              return (
                <button
                  key={item.id}
                  aria-pressed={isSelected}
                  className={`record-row relative flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${combatantKindBackground(item.kind)} ${isSelected ? "border-sky-300/70 after:absolute after:inset-y-2 after:left-0 after:w-1 after:rounded-r-full after:bg-sky-300 after:content-['']" : "border-white/10 hover:border-white/20"} ${index === combat.turn ? "outline outline-2 -outline-offset-2 outline-amber-300" : ""}`}
                  onClick={() => {
                    setSelectedId(item.id);
                    setMobileView("details");
                  }}
                >
                  <span
                    className={`grid size-10 shrink-0 place-items-center rounded-full bg-black/30 font-mono text-sm ${combatantKindText(item.kind)}`}
                  >
                    {item.initiative}
                  </span>
                  <span
                    className={`size-2.5 shrink-0 rounded-full ${combatantKindDot(item.kind)}`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex min-w-0 items-center gap-2">
                      <strong
                        className={`truncate ${item.hitPoints <= 0 ? "text-red-300 line-through" : "text-stone-100"}`}
                      >
                        {displayName(item)}
                      </strong>
                      {index === combat.turn && (
                        <span className="rounded-full bg-amber-300/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-200">
                          Turn
                        </span>
                      )}
                      {isSelected && (
                        <span className="rounded-full bg-sky-300/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-sky-200">
                          Viewing
                        </span>
                      )}
                    </span>
                    <span className="mt-1 block truncate text-xs text-stone-400">
                      {combatantSummary(item, players, monsters)}
                      {item.runtime?.concentration && " · Concentrating"}
                      {item.conditions.some((condition) => condition.saveDue) &&
                        " · Save due"}
                    </span>
                  </span>
                  <span className="w-20 shrink-0 text-right">
                    <span className="block text-xs text-stone-200">
                      {item.hitPoints}/{item.maximumHitPoints} HP
                      {!!item.runtime?.temporaryHitPoints && (
                        <span className="block text-sky-200">
                          +{item.runtime.temporaryHitPoints} temp
                        </span>
                      )}
                    </span>
                    <Progress
                      value={hpPercent}
                      className="mt-2 h-1.5 bg-white/10"
                    />
                  </span>
                  {item.conditions.length > 0 && (
                    <span
                      className="flex text-violet-300"
                      title={item.conditions.map(({ name }) => name).join(", ")}
                    >
                      <ConditionIcon name={item.conditions[0].name} />
                      {item.conditions.length > 1 && (
                        <small>+{item.conditions.length - 1}</small>
                      )}
                    </span>
                  )}
                </button>
              );
            })}
            {!ordered.length && (
              <p className="rounded-lg border border-dashed border-white/10 p-5 text-sm text-stone-400">
                No combatants in initiative order.
              </p>
            )}
          </Tabs.Content>
          <Tabs.Content
            value="details"
            forceMount
            className="min-w-0 data-[state=inactive]:hidden xl:data-[state=inactive]:block"
          >
            <CombatantEditor
              key={selected?.id ?? "empty"}
              combatant={selected}
              editable={editable && !busy}
              adjustHp={adjustHp}
              undoHp={undoHp}
              canUndoHp={
                !!hpUndo &&
                hpUndo.id === selected?.id &&
                JSON.stringify(hpUndo.after) ===
                  JSON.stringify({
                    hitPoints: selected?.hitPoints,
                    runtime: selected?.runtime ?? emptyRuntime(),
                  })
              }
              update={patchSelected}
              remove={removeSelected}
            />
          </Tabs.Content>
        </div>
      </Tabs.Root>
      <Dialog
        open={!!confirmAction}
        onOpenChange={(open) => {
          if (!open) setConfirmAction(null);
        }}
      >
        <DialogContent className="border-white/10 bg-[#151820] text-stone-100">
          <DialogHeader>
            <DialogTitle>
              {confirmAction === "rounds"
                ? "Reset rounds?"
                : confirmAction === "monsters"
                  ? "Clear monsters?"
                  : "Clear combat?"}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-stone-400">
            {confirmAction === "rounds"
              ? "Return to round 1 and the first living combatant. HP and conditions remain unchanged."
              : confirmAction === "monsters"
                ? "Remove all monsters and return to round 1. Players and NPCs remain."
                : "Remove every combatant and return to round 1. Campaign and Bestiary records remain unchanged."}{" "}
            You can reverse this using Undo.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirmAction(null)}>
              Cancel
            </Button>
            <Button
              disabled={busy}
              onClick={() => {
                const action = confirmAction;
                setConfirmAction(null);
                setHpUndo(null);
                if (action === "rounds") void resetRounds();
                else void clear(action === "monsters" ? "monster" : undefined);
              }}
            >
              Confirm
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <CombatantPicker
        campaignId={campaignId}
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        players={players}
        monsters={monsters}
        existingPlayerIds={
          new Set(
            combat.combatants.flatMap(({ playerId }) =>
              playerId ? [playerId] : [],
            ),
          )
        }
        onAdd={addChosen}
      />
    </div>
  );
}

function makeCombatant(
  name: string,
  kind: Combatant["kind"],
  sortOrder: number,
  hp: number,
  ac: number,
  playerId: string | null,
  monsterId: string | null,
  displayNumber: number | null,
  snapshot: Combatant["snapshot"] = null,
): Combatant {
  return {
    id: crypto.randomUUID(),
    playerId,
    monsterId,
    name,
    displayNumber,
    kind,
    notes: "",
    initiative: 10,
    hitPoints: hp,
    maximumHitPoints: hp,
    armorClass: ac,
    sortOrder,
    conditions: [],
    snapshot,
    runtime: snapshot ? runtimeForSnapshot(snapshot) : emptyRuntime(),
    revision: 1,
  };
}
function displayName(item: Combatant) {
  return `${item.name}${item.kind !== "player" && item.displayNumber ? ` #${item.displayNumber}` : ""}`;
}
function combatantKindBackground(kind: Combatant["kind"]) {
  return kind === "player"
    ? "bg-emerald-500/10"
    : kind === "monster"
      ? "bg-red-500/10"
      : "bg-blue-500/10";
}
function combatantKindText(kind: Combatant["kind"]) {
  return kind === "player"
    ? "text-emerald-300"
    : kind === "monster"
      ? "text-red-300"
      : "text-blue-300";
}
function combatantKindDot(kind: Combatant["kind"]) {
  return kind === "player"
    ? "bg-emerald-400"
    : kind === "monster"
      ? "bg-red-400"
      : "bg-blue-400";
}
function combatantSummary(
  item: Combatant,
  players: Player[],
  monsters: Monster[],
) {
  const player = item.playerId
    ? players.find(({ id }) => id === item.playerId)
    : undefined;
  const monster =
    item.snapshot ??
    (item.monsterId
      ? monsters.find(({ id }) => id === item.monsterId)
      : undefined);
  if (player)
    return [
      player.race,
      player.className,
      item.kind === "npc" ? "NPC" : "Player",
      `AC ${item.armorClass}`,
    ]
      .filter(Boolean)
      .join(" · ");
  if (monster)
    return [
      monster.type,
      `CR ${monster.challengeRating}`,
      "Monster",
      `AC ${item.armorClass}`,
    ]
      .filter(Boolean)
      .join(" · ");
  return `${item.kind === "npc" ? "NPC" : "Monster"} · AC ${item.armorClass}`;
}
function normalize(combat: Combat): Combat {
  return normalizeCombat(combat);
}
