"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { adjustHitPoints } from "@/features/combat/hit-points";
import { SaveStatus } from "@/features/shared/save-status";
import { useUnsavedChanges } from "@/features/shared/unsaved-changes";
import { DropdownMenu } from "radix-ui";
import {
  ChevronDown,
  ChevronRight,
  Minus,
  Plus,
  Save,
  Trash2,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  ConditionIcon,
  DEFAULT_CONDITIONS,
} from "@/features/combat/condition-icons";
import {
  RichTextContent,
  RichTextEditor,
} from "@/features/rich-text/rich-text";
import { DetailSection, Stat } from "@/features/shared/ui";
import {
  getV6Combat,
  listV6Monsters,
  listV6Players,
  saveV6Combat,
  undoV6Combat,
  uploadV6Screenshot,
} from "./api-client";
import type { V6Combat, V6Combatant, V6Monster, V6Player } from "./types";

export function CombatScreen({
  campaignId,
  editable,
}: {
  campaignId: string;
  editable: boolean;
}) {
  const [combat, setCombat] = useState<V6Combat | null>(null);
  const [persisted, setPersisted] = useState<V6Combat | null>(null);
  const pending = useRef(false);
  const [hpUndo, setHpUndo] = useState<{
    id: string;
    before: number;
    after: number;
  } | null>(null);
  const [confirmAction, setConfirmAction] = useState<
    "rounds" | "monsters" | "combat" | null
  >(null);
  const dirty =
    !!combat &&
    !!persisted &&
    JSON.stringify(combat) !== JSON.stringify(persisted);
  useUnsavedChanges(dirty);
  const [players, setPlayers] = useState<V6Player[]>([]);
  const [monsters, setMonsters] = useState<V6Monster[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [picker, setPicker] = useState<"players" | "monsters" | null>(null);
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let live = true;
    void Promise.all([
      getV6Combat(campaignId),
      listV6Players(campaignId),
      listV6Monsters(campaignId),
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
  function patchCombat(values: Partial<V6Combat>) {
    if (pending.current) return;
    setCombat((current) => (current ? { ...current, ...values } : current));
  }
  function patchSelected(values: Partial<V6Combatant>) {
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
  async function persist(next: V6Combat, action: string) {
    if (pending.current) return null;
    pending.current = true;
    setBusy(true);
    try {
      const saved = normalize(
        await saveV6Combat(campaignId, normalize(next), action),
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
    if (!combat || !ordered.some(({ hitPoints }) => hitPoints > 0)) return;
    let nextIndex = combat.turn;
    let wrapped = false;
    for (let step = 1; step <= ordered.length; step++) {
      const candidate = (combat.turn + step) % ordered.length;
      if (candidate <= combat.turn) wrapped = true;
      if (ordered[candidate]?.hitPoints > 0) {
        nextIndex = candidate;
        break;
      }
    }
    const incoming = ordered[nextIndex];
    const combatants = combat.combatants.map((item) =>
      item.id === incoming.id
        ? {
            ...item,
            conditions: item.conditions.flatMap((condition) =>
              condition.remainingTurns === null
                ? [condition]
                : condition.remainingTurns > 1
                  ? [
                      {
                        ...condition,
                        remainingTurns: condition.remainingTurns - 1,
                      },
                    ]
                  : [],
            ),
          }
        : item,
    );
    const saved = await persist(
      {
        ...combat,
        combatants,
        turn: nextIndex,
        round: combat.round + (wrapped ? 1 : 0),
      },
      "next_turn",
    );
    if (saved) setSelectedId(incoming.id);
  }
  function adjustHp(amount: number, action: "damage" | "heal") {
    if (!selected || pending.current) return;
    try {
      const next = adjustHitPoints(
        selected.hitPoints,
        selected.maximumHitPoints,
        amount,
        action,
      );
      if (next === selected.hitPoints) return;
      setHpUndo({ id: selected.id, before: selected.hitPoints, after: next });
      patchSelected({ hitPoints: next });
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
              item.id === hpUndo.id && item.hitPoints === hpUndo.after
                ? { ...item, hitPoints: hpUndo.before }
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
      const restored = normalize(await undoV6Combat(campaignId));
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
    if (combat)
      await persist(
        {
          ...combat,
          round: 1,
          turn: Math.max(
            0,
            ordered.findIndex(({ hitPoints }) => hitPoints > 0),
          ),
        },
        "rounds_reset",
      );
  }
  async function clear(kind?: "monster") {
    if (!combat) return;
    const combatants = kind
      ? combat.combatants.filter((item) => item.kind !== kind)
      : [];
    const saved = await persist(
      { ...combat, combatants, round: 1, turn: 0 },
      kind ? "monsters_cleared" : "combat_cleared",
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
  function addNpc() {
    if (!combat) return;
    const item: V6Combatant = {
      id: crypto.randomUUID(),
      playerId: null,
      monsterId: null,
      name: "New NPC",
      displayNumber: null,
      kind: "npc",
      notes: "",
      initiative: 10,
      hitPoints: 10,
      maximumHitPoints: 10,
      armorClass: 10,
      sortOrder: combat.combatants.length,
      conditions: [],
      revision: 1,
    };
    setCombat({ ...combat, combatants: [...combat.combatants, item] });
    setSelectedId(item.id);
  }
  function addCustomMonster() {
    if (!combat) return;
    const displayNumber =
      Math.max(
        0,
        ...combat.combatants
          .filter(({ kind, monsterId }) => kind === "monster" && !monsterId)
          .map((item) => item.displayNumber ?? 0),
      ) + 1;
    const item = makeCombatant(
      "New Monster",
      "monster",
      combat.combatants.length,
      10,
      10,
      null,
      null,
      displayNumber,
    );
    setCombat({ ...combat, combatants: [...combat.combatants, item] });
    setSelectedId(item.id);
  }
  function addChosen() {
    if (!combat || !picker) return;
    const additions: V6Combatant[] = [];
    if (picker === "players")
      for (const player of players.filter(
        ({ id }) =>
          chosen.has(id) &&
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
    if (picker === "monsters")
      for (const monster of monsters.filter(({ id }) => chosen.has(id))) {
        const quantity = quantities[monster.id] ?? 1;
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
            ),
          );
        }
      }
    if (additions.length) {
      setCombat({
        ...combat,
        combatants: [...combat.combatants, ...additions],
      });
      setSelectedId(additions.at(-1)?.id ?? "");
    }
    setPicker(null);
    setChosen(new Set());
    setQuantities({});
    setQuery("");
  }

  if (!combat)
    return (
      <div className="grid min-h-96 place-items-center text-stone-500">
        Loading combat tracker…
      </div>
    );
  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-5">
      <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">
            Live encounter
          </p>
          <Input
            className="mt-2 h-11 max-w-md font-serif text-2xl"
            value={combat.name}
            disabled={!editable || busy}
            onChange={(event) => patchCombat({ name: event.target.value })}
          />
        </div>
        {editable && (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => setPicker("players")}
            >
              Add players / NPCs
            </Button>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => setPicker("monsters")}
            >
              Add bestiary monsters
            </Button>
            <Button
              variant="outline"
              disabled={busy}
              onClick={addCustomMonster}
            >
              <Plus /> Custom monster
            </Button>
            <Button variant="outline" disabled={busy} onClick={addNpc}>
              <Plus /> NPC
            </Button>
          </div>
        )}
      </header>
      <div
        aria-label="Combat turn controls"
        className="sticky top-16 z-20 flex flex-wrap items-center gap-4 rounded-xl border border-amber-300/20 bg-[#17171a]/95 p-4 shadow-lg backdrop-blur lg:top-0"
      >
        <div>
          <p className="text-xs uppercase text-stone-500">Round</p>
          <p className="font-serif text-2xl text-amber-200">{combat.round}</p>
        </div>
        <div className="h-10 w-px bg-white/10" />
        <div className="min-w-0 flex-1">
          <p className="text-xs uppercase text-stone-500">Current turn</p>
          <p className="truncate">
            {active ? displayName(active) : "No combatants"}
          </p>
        </div>
        {editable && (
          <div className="flex flex-wrap gap-2">
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
              disabled={busy || !ordered.some(({ hitPoints }) => hitPoints > 0)}
              className="bg-[#d75b42] hover:bg-[#ec6b50]"
            >
              Next turn <ChevronRight />
            </Button>
          </div>
        )}
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,3fr)_minmax(0,7fr)]">
        <div className="space-y-2">
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
                className={`relative flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${combatantKindBackground(item.kind)} ${isSelected ? "border-sky-300/70 after:absolute after:inset-y-2 after:left-0 after:w-1 after:rounded-r-full after:bg-sky-300 after:content-['']" : "border-white/10 hover:border-white/20"} ${index === combat.turn ? "outline outline-2 -outline-offset-2 outline-amber-300" : ""}`}
                onClick={() => setSelectedId(item.id)}
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
                  <span className="mt-1 block truncate text-xs text-stone-500">
                    {combatantSummary(item, players, monsters)}
                  </span>
                </span>
                <span className="w-20 shrink-0 text-right">
                  <span className="block text-xs text-stone-200">
                    {item.hitPoints}/{item.maximumHitPoints} HP
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
        </div>
        <CombatantEditor
          key={selected?.id ?? "empty"}
          combatant={selected}
          monster={monsters.find(({ id }) => id === selected?.monsterId)}
          editable={editable && !busy}
          adjustHp={adjustHp}
          undoHp={undoHp}
          canUndoHp={
            !!hpUndo &&
            hpUndo.id === selected?.id &&
            hpUndo.after === selected?.hitPoints
          }
          update={patchSelected}
          remove={removeSelected}
        />
      </div>
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
      <Picker
        open={!!picker}
        kind={picker}
        players={players}
        monsters={monsters}
        existingPlayerIds={
          new Set(
            combat.combatants.flatMap(({ playerId }) =>
              playerId ? [playerId] : [],
            ),
          )
        }
        chosen={chosen}
        setChosen={setChosen}
        quantities={quantities}
        setQuantities={setQuantities}
        query={query}
        setQuery={setQuery}
        close={() => {
          setPicker(null);
          setChosen(new Set());
          setQuantities({});
        }}
        add={addChosen}
      />
    </div>
  );
}

function CombatantEditor({
  combatant,
  monster,
  editable,
  update,
  remove,
  adjustHp,
  undoHp,
  canUndoHp,
}: {
  combatant?: V6Combatant;
  monster?: V6Monster;
  editable: boolean;
  update: (part: Partial<V6Combatant>) => void;
  remove: () => void;
  adjustHp: (amount: number, action: "damage" | "heal") => void;
  undoHp: () => void;
  canUndoHp: boolean;
}) {
  const [condition, setCondition] = useState("Poisoned");
  const [duration, setDuration] = useState("");
  const [hpAmount, setHpAmount] = useState("");
  if (!combatant)
    return (
      <div className="rounded-xl border border-dashed border-white/10 p-12 text-center text-stone-600">
        Add a combatant to begin.
      </div>
    );
  const current = combatant;
  function addCondition() {
    const name = condition.trim();
    if (!name) return;
    update({
      conditions: [
        ...current.conditions,
        {
          id: crypto.randomUUID(),
          name,
          remainingTurns: duration ? Math.max(1, Number(duration)) : null,
        },
      ],
    });
    setDuration("");
  }
  const hpPercent =
    combatant.maximumHitPoints > 0
      ? Math.max(
          0,
          Math.min(
            100,
            (combatant.hitPoints / combatant.maximumHitPoints) * 100,
          ),
        )
      : 0;
  return (
    <aside className="rounded-xl border border-white/10 bg-[#13161d] p-5 xl:self-start">
      <div className="flex items-start gap-2">
        <Input
          className="h-11 min-w-0 flex-1 font-serif text-lg text-amber-100"
          value={combatant.name}
          disabled={!editable}
          onFocus={(event) => event.currentTarget.select()}
          onChange={(event) => update({ name: event.target.value })}
        />
        {combatant.kind !== "player" && (
          <Input
            aria-label="Combatant number"
            className="h-11 w-24 text-center font-serif"
            type="number"
            min={1}
            placeholder="#"
            value={combatant.displayNumber ?? ""}
            disabled={!editable}
            onChange={(event) =>
              update({
                displayNumber:
                  event.target.value === ""
                    ? null
                    : Math.max(1, Number(event.target.value)),
              })
            }
          />
        )}
        {editable && (
          <Button
            size="icon"
            variant="ghost"
            className="text-stone-600 hover:text-red-300"
            onClick={remove}
          >
            <Trash2 />
          </Button>
        )}
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <label className="text-xs text-stone-500">
          Type
          <select
            className={`mt-1 h-10 w-full rounded-md border border-white/10 bg-[#191d27] px-2 text-sm font-medium ${combatantKindText(combatant.kind)}`}
            value={combatant.kind}
            disabled={!editable || !!combatant.playerId}
            onChange={(event) =>
              update({ kind: event.target.value as V6Combatant["kind"] })
            }
          >
            <option value="player">Player</option>
            <option value="monster">Monster</option>
            <option value="npc">NPC</option>
          </select>
        </label>
        <NumberField
          label="Initiative"
          value={combatant.initiative}
          disabled={!editable}
          change={(initiative) => update({ initiative })}
        />
        <NumberField
          label="Armor class"
          value={combatant.armorClass}
          disabled={!editable}
          change={(armorClass) => update({ armorClass })}
        />
      </div>
      <section className="mt-5">
        <div className="mb-2 flex justify-between text-sm">
          <span className="text-stone-400">Hit points</span>
          <span>
            {combatant.hitPoints} / {combatant.maximumHitPoints}
          </span>
        </div>
        <Progress value={hpPercent} className="h-2.5 bg-white/10" />
        {editable && (
          <div className="mt-3 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <label className="text-xs text-stone-400">
                Amount
                <Input
                  aria-label="Damage or healing amount"
                  type="number"
                  min="0"
                  step="any"
                  className="mt-1 w-24"
                  value={hpAmount}
                  onChange={(event) => setHpAmount(event.target.value)}
                />
              </label>
              <Button
                variant="outline"
                disabled={
                  !Number.isFinite(Number(hpAmount)) || Number(hpAmount) <= 0
                }
                onClick={() => adjustHp(Number(hpAmount), "damage")}
              >
                Damage
              </Button>
              <Button
                variant="outline"
                disabled={
                  !Number.isFinite(Number(hpAmount)) || Number(hpAmount) <= 0
                }
                onClick={() => adjustHp(Number(hpAmount), "heal")}
              >
                Heal
              </Button>
              <Button variant="ghost" disabled={!canUndoHp} onClick={undoHp}>
                <Undo2 /> Undo HP change
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="icon"
                variant="outline"
                onClick={() =>
                  update({ hitPoints: Math.max(0, combatant.hitPoints - 1) })
                }
              >
                <Minus />
              </Button>
              <Input
                aria-label="Current hit points"
                className="w-20 text-center"
                type="number"
                value={combatant.hitPoints}
                onChange={(event) =>
                  update({ hitPoints: Number(event.target.value) })
                }
              />
              <span className="text-stone-600">/</span>
              <Input
                aria-label="Maximum hit points"
                className="w-20 text-center"
                type="number"
                min={0}
                value={combatant.maximumHitPoints}
                onChange={(event) =>
                  update({
                    maximumHitPoints: Math.max(0, Number(event.target.value)),
                  })
                }
              />
              <Button
                size="icon"
                variant="outline"
                onClick={() =>
                  update({
                    hitPoints: Math.min(
                      combatant.maximumHitPoints,
                      combatant.hitPoints + 1,
                    ),
                  })
                }
              >
                <Plus />
              </Button>
            </div>
          </div>
        )}
      </section>
      <section className="mt-6 border-t border-white/10 pt-5">
        <h3 className="font-serif text-lg text-amber-200">Status conditions</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          {combatant.conditions.length ? (
            combatant.conditions.map((entry) => (
              <button
                key={entry.id}
                disabled={!editable}
                onClick={() =>
                  update({
                    conditions: combatant.conditions.filter(
                      ({ id }) => id !== entry.id,
                    ),
                  })
                }
                className="flex items-center gap-1.5 rounded-full bg-violet-400/15 px-3 py-1.5 text-xs text-violet-200"
              >
                <ConditionIcon name={entry.name} />
                {entry.name}
                {entry.remainingTurns !== null &&
                  ` · ${entry.remainingTurns} turn${entry.remainingTurns === 1 ? "" : "s"}`}
              </button>
            ))
          ) : (
            <span className="text-sm text-stone-600">No active conditions</span>
          )}
        </div>
        {editable && (
          <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_7rem_auto]">
            <div className="flex min-w-0 gap-1">
              <Input
                aria-label="Condition name"
                maxLength={120}
                placeholder="Choose or type a condition…"
                value={condition}
                onChange={(event) => setCondition(event.target.value)}
              />
              <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    aria-label="Choose a default condition"
                  >
                    <ChevronDown />
                  </Button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content
                    sideOffset={4}
                    align="end"
                    aria-label="Default conditions"
                    className="z-50 max-h-72 min-w-48 overflow-y-auto rounded-md border border-white/10 bg-[#151820] p-1 text-stone-100 shadow-lg"
                  >
                    {DEFAULT_CONDITIONS.map((name) => (
                      <DropdownMenu.Item
                        key={name}
                        onSelect={() => setCondition(name)}
                        className="flex cursor-pointer items-center gap-2 rounded px-3 py-2 text-sm outline-none data-[highlighted]:bg-white/10"
                      >
                        <ConditionIcon name={name} /> {name}
                      </DropdownMenu.Item>
                    ))}
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
            </div>
            <Input
              type="number"
              min={1}
              placeholder="Turns"
              value={duration}
              onChange={(event) => setDuration(event.target.value)}
            />
            <Button variant="outline" onClick={addCondition}>
              <Plus /> Add
            </Button>
          </div>
        )}
      </section>
      <div className="mt-5">
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-stone-500">
          Encounter notes
        </p>
        {editable ? (
          <RichTextEditor
            value={combatant.notes}
            onChange={(notes) => update({ notes })}
            onPasteImage={uploadV6Screenshot}
            placeholder="Notes for this combatant in the current encounter…"
            className="min-h-28"
          />
        ) : combatant.notes ? (
          <RichTextContent value={combatant.notes} />
        ) : (
          <p className="text-sm text-stone-600">No encounter notes.</p>
        )}
      </div>
      {combatant.kind === "monster" && <MonsterStatBlock monster={monster} />}
    </aside>
  );
}

function MonsterStatBlock({ monster }: { monster?: V6Monster }) {
  if (!monster)
    return (
      <div className="mt-6 rounded-lg border border-dashed border-white/10 p-6 text-center text-sm text-stone-500">
        This one-time monster has no linked Bestiary stat block.
      </div>
    );
  const slots = monster.spellSlots
    .map((count, index) => ({ level: index + 1, count }))
    .filter(({ count }) => count > 0);
  return (
    <section className="mt-6 border-t border-white/10 pt-5">
      <div className="mb-4">
        <h3 className="font-serif text-2xl text-amber-100">{monster.name}</h3>
        <p className="text-sm italic text-stone-500">
          {monster.type || "Unknown type"} · CR {monster.challengeRating || "—"}
          {monster.source ? ` · ${monster.source}` : ""}
        </p>
        {!!monster.tags.length && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {monster.tags.map((tag) => (
              <span
                key={tag.id}
                className="rounded-full border border-white/10 px-2 py-0.5 text-xs text-stone-400"
                style={
                  tag.color
                    ? { borderColor: tag.color, color: tag.color }
                    : undefined
                }
              >
                {tag.name}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Armor class" value={monster.armorClass} />
        <Stat label="Hit points" value={monster.hitPoints} />
        <Stat label="Speed" value={monster.speed || "—"} />
      </div>
      <MonsterDetail title="Ability scores" value={monster.stats} />
      <MonsterDetail title="Actions & traits" value={monster.abilities} />
      <DetailSection title="Spellcasting">
        {monster.spells ? (
          <RichTextContent value={monster.spells} />
        ) : (
          <p className="text-stone-600">
            No spellcasting information recorded.
          </p>
        )}
        {!!slots.length && (
          <div className="mt-3 flex flex-wrap gap-2">
            {slots.map(({ level, count }) => (
              <span
                key={level}
                className="rounded-md border border-violet-300/20 bg-violet-300/5 px-2 py-1 text-xs text-violet-200"
              >
                Level {level}: {count} slot{count === 1 ? "" : "s"}
              </span>
            ))}
          </div>
        )}
      </DetailSection>
      {!!monster.notes && <MonsterDetail title="Notes" value={monster.notes} />}
    </section>
  );
}

function MonsterDetail({ title, value }: { title: string; value: string }) {
  return (
    <DetailSection title={title}>
      {value ? (
        <RichTextContent value={value} />
      ) : (
        <p className="text-stone-600">No information recorded.</p>
      )}
    </DetailSection>
  );
}

function Picker({
  open,
  kind,
  players,
  monsters,
  existingPlayerIds,
  chosen,
  setChosen,
  quantities,
  setQuantities,
  query,
  setQuery,
  close,
  add,
}: {
  open: boolean;
  kind: "players" | "monsters" | null;
  players: V6Player[];
  monsters: V6Monster[];
  existingPlayerIds: Set<string>;
  chosen: Set<string>;
  setChosen: React.Dispatch<React.SetStateAction<Set<string>>>;
  quantities: Record<string, number>;
  setQuantities: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  query: string;
  setQuery: (value: string) => void;
  close: () => void;
  add: () => void;
}) {
  const entries =
    kind === "players"
      ? players.filter(({ id }) => !existingPlayerIds.has(id))
      : monsters;
  const total =
    kind === "monsters"
      ? [...chosen].reduce((sum, id) => sum + (quantities[id] ?? 1), 0)
      : chosen.size;
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value) close();
      }}
    >
      <DialogContent className="border-white/10 bg-[#151820] text-stone-100">
        <DialogHeader>
          <DialogTitle>
            Add campaign {kind === "players" ? "players / NPCs" : kind}
          </DialogTitle>
        </DialogHeader>
        <Input
          type="search"
          placeholder="Search…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <div className="max-h-72 space-y-1 overflow-y-auto">
          {entries
            .filter((entry) =>
              entry.name.toLowerCase().includes(query.toLowerCase()),
            )
            .map((entry) => {
              const checked = chosen.has(entry.id);
              return (
                <div
                  key={entry.id}
                  className="flex items-center gap-3 rounded p-2 hover:bg-white/5"
                >
                  <Checkbox
                    aria-label={`Select ${entry.name}`}
                    checked={checked}
                    onCheckedChange={(value) =>
                      setChosen((current) => {
                        const next = new Set(current);
                        if (value) next.add(entry.id);
                        else next.delete(entry.id);
                        return next;
                      })
                    }
                  />
                  <span className="min-w-0 flex-1 truncate">{entry.name}</span>
                  {kind === "players" && (
                    <span
                      className={combatantKindText(
                        (entry as V6Player).kind ?? "player",
                      )}
                    >
                      {(entry as V6Player).kind === "npc" ? "NPC" : "Player"}
                    </span>
                  )}
                  {kind === "monsters" && (
                    <Input
                      aria-label={`Quantity for ${entry.name}`}
                      title={`Quantity for ${entry.name}`}
                      className="h-8 w-20 text-center"
                      type="number"
                      min={1}
                      max={99}
                      value={quantities[entry.id] ?? 1}
                      onFocus={() =>
                        setChosen((current) => new Set(current).add(entry.id))
                      }
                      onChange={(event) => {
                        const quantity = clampQuantity(event.target.value);
                        setQuantities((current) => ({
                          ...current,
                          [entry.id]: quantity,
                        }));
                        setChosen((current) => new Set(current).add(entry.id));
                      }}
                    />
                  )}
                </div>
              );
            })}
        </div>
        <Button onClick={add} disabled={!chosen.size}>
          Add selected ({total})
        </Button>
      </DialogContent>
    </Dialog>
  );
}
function clampQuantity(value: string) {
  return Math.max(1, Math.min(99, Number.parseInt(value, 10) || 1));
}
function NumberField({
  label,
  value,
  disabled,
  change,
}: {
  label: string;
  value: number;
  disabled: boolean;
  change: (value: number) => void;
}) {
  return (
    <label className="text-xs text-stone-500">
      {label}
      <Input
        className="mt-1"
        type="number"
        value={value}
        disabled={disabled}
        onChange={(event) => change(Number(event.target.value))}
      />
    </label>
  );
}
function makeCombatant(
  name: string,
  kind: V6Combatant["kind"],
  sortOrder: number,
  hp: number,
  ac: number,
  playerId: string | null,
  monsterId: string | null,
  displayNumber: number | null,
): V6Combatant {
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
    revision: 1,
  };
}
function displayName(item: V6Combatant) {
  return `${item.name}${item.kind !== "player" && item.displayNumber ? ` #${item.displayNumber}` : ""}`;
}
function combatantKindBackground(kind: V6Combatant["kind"]) {
  return kind === "player"
    ? "bg-emerald-500/10"
    : kind === "monster"
      ? "bg-red-500/10"
      : "bg-blue-500/10";
}
function combatantKindText(kind: V6Combatant["kind"]) {
  return kind === "player"
    ? "text-emerald-300"
    : kind === "monster"
      ? "text-red-300"
      : "text-blue-300";
}
function combatantKindDot(kind: V6Combatant["kind"]) {
  return kind === "player"
    ? "bg-emerald-400"
    : kind === "monster"
      ? "bg-red-400"
      : "bg-blue-400";
}
function combatantSummary(
  item: V6Combatant,
  players: V6Player[],
  monsters: V6Monster[],
) {
  const player = item.playerId
    ? players.find(({ id }) => id === item.playerId)
    : undefined;
  const monster = item.monsterId
    ? monsters.find(({ id }) => id === item.monsterId)
    : undefined;
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
function normalize(combat: V6Combat): V6Combat {
  const combatants = [...combat.combatants]
    .sort((a, b) => b.initiative - a.initiative || a.sortOrder - b.sortOrder)
    .map((item, sortOrder) => ({ ...item, sortOrder }));
  return {
    ...combat,
    combatants,
    turn: Math.min(combat.turn, Math.max(0, combatants.length - 1)),
  };
}
