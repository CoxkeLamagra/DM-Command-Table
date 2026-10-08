"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  ChevronsUpDown,
  Pencil,
  Play,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import { SaveStatus } from "@/features/shared/save-status";
import { reconcileSaved } from "@/features/encounters/drafts";
import { useUnsavedChanges } from "@/features/shared/unsaved-changes";
import type { EncounterDraftController } from "./api-client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  CombatantPicker,
  type CombatantSelection,
} from "@/features/shared/combatant-picker";
import { EncounterSummary } from "@/features/encounters/encounter-summary";
import {
  RichTextContent,
  RichTextEditor,
} from "@/features/rich-text/rich-text";
import {
  createPreparedEncounter,
  deletePreparedEncounter,
  getV6Combat,
  listPreparedEncounters,
  listV6Monsters,
  listV6Players,
  saveV6Combat,
  updatePreparedEncounter,
  uploadV6Screenshot,
} from "./api-client";
import type {
  PreparedCombatant,
  V6Combatant,
  V6Monster,
  V6Player,
  V6PreparedEncounter,
} from "./types";

export function PreparedEncounters({
  campaignId,
  sessionId,
  editable,
  onOpenCombat,
  registerSave,
  onDirtyChange,
  onCountChange,
  savingSession = false,
}: {
  campaignId: string;
  sessionId: string;
  editable: boolean;
  onOpenCombat: () => void;
  onDirtyChange?: (sessionId: string, dirty: boolean) => void;
  onCountChange?: (sessionId: string, count: number) => void;
  savingSession?: boolean;
  registerSave?: (
    sessionId: string,
    controller: EncounterDraftController,
  ) => () => void;
}) {
  const [items, setItems] = useState<V6PreparedEncounter[]>([]);
  useEffect(() => {
    onCountChange?.(sessionId, items.length);
  }, [onCountChange, sessionId, items.length]);
  const itemsRef = useRef<V6PreparedEncounter[]>([]);
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [editingCombatants, setEditingCombatants] = useState<Set<string>>(
    () => new Set(),
  );
  const [dirty, setDirty] = useState<Set<string>>(() => new Set());
  useUnsavedChanges(dirty.size > 0);
  const [savingEncounter, setSavingEncounter] = useState<string | null>(null);
  useEffect(() => {
    onDirtyChange?.(sessionId, dirty.size > 0);
  }, [onDirtyChange, sessionId, dirty.size]);
  const [visited, setVisited] = useState<Set<string>>(() => new Set());
  const [busy, setBusy] = useState(false);
  const [monsters, setMonsters] = useState<V6Monster[]>([]);
  const [players, setPlayers] = useState<V6Player[]>([]);
  const [addingTo, setAddingTo] = useState<string>();

  useEffect(() => {
    let live = true;
    void Promise.all([
      listPreparedEncounters(campaignId, sessionId),
      listV6Monsters(campaignId),
      listV6Players(campaignId),
    ])
      .then(([value, bestiary, characters]) => {
        if (live) {
          setExpanded(new Set());
          setItems(value);
          itemsRef.current = value;
          setMonsters(bestiary);
          setPlayers(characters);
          setOpen(value.length > 0);
        }
      })
      .catch(report);
    return () => {
      live = false;
    };
  }, [campaignId, sessionId]);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  function report(reason: unknown) {
    toast.error(
      reason instanceof Error ? reason.message : "Encounter update failed.",
    );
  }
  async function add() {
    setBusy(true);
    try {
      const item = await createPreparedEncounter(
        campaignId,
        sessionId,
        items.length,
      );
      setItems((all) => [...all, item]);
      setOpen(true);
    } catch (error) {
      report(error);
    } finally {
      setBusy(false);
    }
  }
  async function save(item: V6PreparedEncounter) {
    setSavingEncounter(item.id);
    setBusy(true);
    try {
      const saved = await updatePreparedEncounter(campaignId, item);
      const current = itemsRef.current.find(({ id }) => id === item.id);
      setItems((all) =>
        all.map((entry) =>
          entry.id === saved.id ? reconcileSaved(entry, item, saved) : entry,
        ),
      );
      if (current === item)
        setDirty((ids) => {
          const next = new Set(ids);
          next.delete(item.id);
          return next;
        });
      toast.success("Encounter saved");
    } catch (error) {
      report(error);
    } finally {
      setSavingEncounter(null);
      setBusy(false);
    }
  }
  const reconcile = useCallback(
    (submitted: V6PreparedEncounter[], saved: V6PreparedEncounter[]) => {
      const submittedById = new Map(submitted.map((item) => [item.id, item]));
      const savedById = new Map(saved.map((item) => [item.id, item]));
      const changed = new Set(
        itemsRef.current
          .filter((item) => item !== submittedById.get(item.id))
          .map(({ id }) => id),
      );
      setItems((all) =>
        all.map((item) => {
          const original = submittedById.get(item.id);
          const result = savedById.get(item.id);
          return original && result
            ? reconcileSaved(item, original, result)
            : item;
        }),
      );
      setDirty(changed);
    },
    [],
  );
  useEffect(
    () =>
      registerSave?.(sessionId, {
        snapshot: () => itemsRef.current,
        reconcile,
      }),
    [registerSave, reconcile, sessionId],
  );
  async function remove(item: V6PreparedEncounter) {
    if (!window.confirm(`Delete ${item.name}?`)) return;
    setBusy(true);
    try {
      await deletePreparedEncounter(campaignId, item);
      setItems((all) => all.filter(({ id }) => id !== item.id));
      setDirty((ids) => {
        const next = new Set(ids);
        next.delete(item.id);
        return next;
      });
    } catch (error) {
      report(error);
    } finally {
      setBusy(false);
    }
  }
  function patch(id: string, values: Partial<V6PreparedEncounter>) {
    setDirty((ids) => new Set(ids).add(id));
    setItems((all) =>
      all.map((item) => (item.id === id ? { ...item, ...values } : item)),
    );
  }
  function toggleEncounter(id: string) {
    setVisited((current) => new Set(current).add(id));
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  const allExpanded =
    items.length > 0 && items.every(({ id }) => expanded.has(id));

  function customizeMonster(item: V6PreparedEncounter, entryId: string) {
    const entry = item.monsters.find(({ id }) => id === entryId);
    const monster = monsters.find(({ id }) => id === entry?.monsterId);
    if (!entry || !monster) return;
    const stats = `${monster.speed} ${monster.stats}`.replace(
      /[&<>"']/g,
      (char) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[char]!,
    );
    const additions: V6Combatant[] = Array.from(
      { length: entry.quantity },
      (_, offset) => ({
        id: crypto.randomUUID(),
        playerId: null,
        monsterId: null,
        name: monster.name,
        kind: "monster",
        displayNumber: (entry.displayNumber ?? 1) + offset,
        initiative: 10,
        hitPoints: monster.hitPoints,
        maximumHitPoints: monster.hitPoints,
        armorClass: monster.armorClass,
        notes: `<p>${stats}</p>${monster.abilities}${monster.spells}${monster.notes}`,
        sortOrder: offset,
        conditions: [],
        revision: 1,
      }),
    );
    setEditingCombatants(
      (current) => new Set([...current, ...additions.map(({ id }) => id)]),
    );
    patch(item.id, {
      monsters: item.monsters.filter(({ id }) => id !== entryId),
      combatants: [...(item.combatants ?? []), ...additions],
    });
  }

  function addChosen(selection: CombatantSelection) {
    if (!addingTo) return;
    setDirty((ids) => new Set(ids).add(addingTo));
    setItems((all) =>
      all.map((item) => {
        if (item.id !== addingTo) return item;
        const rosterAdditions: PreparedCombatant[] = players
          .filter(({ id }) => selection.playerIds.includes(id))
          .map((player, offset) => ({
            id: crypto.randomUUID(),
            name: player.name,
            kind: player.kind ?? "player",
            notes: player.notes,
            displayNumber: null,
            initiative: 10,
            hitPoints: player.hitPoints ?? 10,
            maximumHitPoints: player.hitPoints ?? 10,
            armorClass: player.armorClass ?? 10,
            sortOrder: (item.combatants?.length ?? 0) + offset,
          }));
        if (selection.singleUse) {
          const value = selection.singleUse;
          rosterAdditions.push({
            id: crypto.randomUUID(),
            name: value.name,
            kind: value.kind,
            displayNumber: null,
            initiative: 10,
            hitPoints: value.hitPoints,
            maximumHitPoints: value.hitPoints,
            armorClass: value.armorClass,
            notes: "",
            sortOrder: (item.combatants?.length ?? 0) + rosterAdditions.length,
          });
        }
        const additions = selection.monsters.map(
          ({ id: monsterId, quantity }, offset) => {
            const existing = item.monsters
              .filter((entry) => entry.monsterId === monsterId)
              .map(
                ({ displayNumber, quantity }) =>
                  (displayNumber ?? 1) + quantity - 1,
              );
            return {
              id: crypto.randomUUID(),
              monsterId,
              displayNumber: Math.max(0, ...existing) + 1,
              quantity,
              sortOrder: item.monsters.length + offset,
            };
          },
        );
        return {
          ...item,
          monsters: [...item.monsters, ...additions],
          combatants: [...(item.combatants ?? []), ...rosterAdditions],
        };
      }),
    );
    setAddingTo(undefined);
  }
  async function loadInCombat(item: V6PreparedEncounter) {
    if (
      !window.confirm(
        `Load "${item.name}" in Combat? Current monsters will be replaced; players and NPCs remain.`,
      )
    )
      return;
    setBusy(true);
    try {
      const total =
        item.monsters.reduce((sum, entry) => sum + entry.quantity, 0) +
        (item.combatants?.length ?? 0);
      if (total > 10_000)
        throw new Error(
          "Combat supports at most 10,000 combatants. Reduce the encounter quantities before loading.",
        );
      const combat = await getV6Combat(campaignId);
      const survivors = combat.combatants.filter(
        ({ kind }) => kind !== "monster",
      );
      const additions = item.monsters.flatMap((entry) => {
        const monster = monsters.find(({ id }) => id === entry.monsterId);
        if (!monster) return [];
        return Array.from({ length: entry.quantity }, (_, offset) => ({
          id: crypto.randomUUID(),
          playerId: null,
          monsterId: monster.id,
          name: monster.name,
          displayNumber: (entry.displayNumber ?? 1) + offset,
          kind: "monster" as const,
          notes: "",
          initiative: 10,
          hitPoints: monster.hitPoints,
          maximumHitPoints: monster.hitPoints,
          armorClass: monster.armorClass,
          sortOrder: survivors.length + offset,
          conditions: [],
          revision: 1,
        }));
      });
      await saveV6Combat(
        campaignId,
        {
          ...combat,
          name: item.name || "Prepared encounter",
          round: 1,
          turn: 0,
          combatants: [
            ...survivors,
            ...additions,
            ...(item.combatants ?? []).map((entry, offset) => ({
              ...entry,
              id: crypto.randomUUID(),
              playerId: null,
              monsterId: null,
              sortOrder: survivors.length + additions.length + offset,
              conditions: [],
              revision: 1,
            })),
          ].map((entry, sortOrder) => ({ ...entry, sortOrder })),
        },
        "prepared_encounter_loaded",
      );
      toast.success("Prepared encounter loaded");
      onOpenCombat();
    } catch (error) {
      report(error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-5 border-t border-white/10 pt-4">
      <div className="flex items-center justify-between">
        <button
          type="button"
          aria-expanded={open}
          className="flex items-center gap-2 text-sm font-medium"
          onClick={() => setOpen((value) => !value)}
        >
          {open ? (
            <ChevronDown className="size-4" />
          ) : (
            <ChevronRight className="size-4" />
          )}{" "}
          Prepared encounters ({items.length})
        </button>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {items.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setOpen(true);
                setVisited(
                  (current) =>
                    new Set([...current, ...items.map(({ id }) => id)]),
                );
                setExpanded(
                  allExpanded ? new Set() : new Set(items.map(({ id }) => id)),
                );
              }}
            >
              <ChevronsUpDown /> {allExpanded ? "Collapse all" : "Expand all"}
            </Button>
          )}
          {editable && (
            <Button size="sm" variant="outline" disabled={busy} onClick={add}>
              <Plus /> Encounter
            </Button>
          )}
        </div>
      </div>
      {open && (
        <div className="mt-3 space-y-3">
          {items.length === 0 ? (
            <p className="rounded-lg border border-dashed border-white/10 p-4 text-sm text-stone-400">
              No encounters prepared yet.
            </p>
          ) : (
            items.map((item) => (
              <div
                key={item.id}
                className="rounded-lg border border-white/10 bg-black/20 p-4"
              >
                <button
                  type="button"
                  aria-expanded={expanded.has(item.id)}
                  aria-controls={`encounter-details-${item.id}`}
                  className="flex w-full items-center gap-2 text-left"
                  onClick={() => toggleEncounter(item.id)}
                >
                  {expanded.has(item.id) ? (
                    <ChevronDown className="size-4 shrink-0" />
                  ) : (
                    <ChevronRight className="size-4 shrink-0" />
                  )}
                  <span className="min-w-0 flex-1 truncate font-medium">
                    {item.name || "Untitled encounter"}
                  </span>
                  <SaveStatus
                    dirty={dirty.has(item.id)}
                    saving={savingSession || savingEncounter === item.id}
                    label={`Encounter ${item.name}`}
                  />
                </button>
                <EncounterSummary encounter={item} monsters={monsters} />
                {visited.has(item.id) && (
                  <div
                    id={`encounter-details-${item.id}`}
                    hidden={!expanded.has(item.id)}
                    className="mt-3 border-t border-white/10 pt-3"
                  >
                    <div className="flex gap-2">
                      <Input
                        value={item.name}
                        disabled={!editable || busy}
                        onChange={(event) =>
                          patch(item.id, { name: event.target.value })
                        }
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        disabled={!editable || busy}
                        aria-label={`Save encounter ${item.name}`}
                        title="Save this encounter"
                        onClick={() => save(item)}
                      >
                        <Save />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        disabled={!editable || busy}
                        aria-label={`Delete encounter ${item.name}`}
                        onClick={() => remove(item)}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                    <div className="mt-3">
                      {editable ? (
                        <RichTextEditor
                          value={item.notes}
                          onChange={(notes) => patch(item.id, { notes })}
                          onPasteImage={uploadV6Screenshot}
                          placeholder="Encounter tactics and notes…"
                          className="min-h-24"
                        />
                      ) : (
                        <RichTextContent value={item.notes} />
                      )}
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <p className="text-xs font-medium uppercase tracking-wider text-stone-400">
                        Bestiary monsters (
                        {item.monsters.reduce(
                          (total, entry) => total + entry.quantity,
                          0,
                        )}
                        )
                      </p>
                      {editable && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy || savingSession}
                          onClick={() => setAddingTo(item.id)}
                        >
                          <Plus /> Add combatants
                        </Button>
                      )}
                    </div>
                    <div className="mt-2 space-y-1">
                      {item.monsters.map((entry) => {
                        const monster = monsters.find(
                          ({ id }) => id === entry.monsterId,
                        );
                        return (
                          <div
                            key={entry.id}
                            className="flex items-center gap-2 rounded bg-white/5 px-3 py-2 text-sm"
                          >
                            <span className="min-w-0 flex-1 truncate">
                              {monster?.name ?? "Missing monster"}
                              {entry.displayNumber
                                ? ` #${entry.displayNumber}`
                                : ""}
                            </span>
                            <span className="text-xs text-stone-400">
                              × {entry.quantity}
                            </span>
                            {editable && (
                              <>
                                <Button
                                  size="icon-xs"
                                  variant="ghost"
                                  aria-label={`Edit details for ${monster?.name ?? "monster"}`}
                                  onClick={() =>
                                    customizeMonster(item, entry.id)
                                  }
                                >
                                  <Pencil />
                                </Button>
                                <Button
                                  size="icon-xs"
                                  variant="ghost"
                                  onClick={() =>
                                    patch(item.id, {
                                      monsters: item.monsters.filter(
                                        ({ id }) => id !== entry.id,
                                      ),
                                    })
                                  }
                                >
                                  <Trash2 />
                                </Button>
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    {(item.combatants ?? []).map((combatant) => (
                      <PreparedCombatantEditor
                        key={combatant.id}
                        combatant={combatant}
                        expanded={editingCombatants.has(combatant.id)}
                        onToggle={() =>
                          setEditingCombatants((current) => {
                            const next = new Set(current);
                            if (next.has(combatant.id))
                              next.delete(combatant.id);
                            else next.add(combatant.id);
                            return next;
                          })
                        }
                        editable={editable && !busy}
                        onChange={(values) =>
                          patch(item.id, {
                            combatants: (item.combatants ?? []).map((value) =>
                              value.id === combatant.id
                                ? { ...value, ...values }
                                : value,
                            ),
                          })
                        }
                        onRemove={() =>
                          patch(item.id, {
                            combatants: (item.combatants ?? []).filter(
                              ({ id }) => id !== combatant.id,
                            ),
                          })
                        }
                      />
                    ))}
                    {editable && (
                      <Button
                        className="mt-3 w-full"
                        disabled={
                          (!item.monsters.length && !item.combatants?.length) ||
                          busy
                        }
                        onClick={() => loadInCombat(item)}
                      >
                        <Play /> Load in Combat
                      </Button>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
      <CombatantPicker
        open={!!addingTo}
        onOpenChange={(value) => {
          if (!value) setAddingTo(undefined);
        }}
        players={players}
        monsters={monsters}
        onAdd={addChosen}
      />
    </div>
  );
}

function PreparedCombatantEditor({
  expanded,
  onToggle,
  combatant,
  editable,
  onChange,
  onRemove,
}: {
  expanded: boolean;
  onToggle: () => void;
  combatant: PreparedCombatant;
  editable: boolean;
  onChange: (value: Partial<PreparedCombatant>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="mt-3 space-y-3 rounded-lg border border-white/10 p-3">
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={`prepared-combatant-${combatant.id}`}
        aria-label={`${expanded ? "Collapse" : "Edit"} details for ${combatant.name}`}
        className="flex w-full items-center gap-2 text-left"
        onClick={onToggle}
      >
        {expanded ? (
          <ChevronDown className="size-4" />
        ) : (
          <ChevronRight className="size-4" />
        )}
        <span className="min-w-0 flex-1 truncate font-medium">
          {combatant.name}
          {combatant.displayNumber ? ` #${combatant.displayNumber}` : ""}
        </span>
        <span className="text-xs text-stone-400">
          {combatant.kind === "npc"
            ? "NPC"
            : combatant.kind === "player"
              ? "Player"
              : "Combatant"}
        </span>
      </button>
      <div
        id={`prepared-combatant-${combatant.id}`}
        hidden={!expanded}
        className="space-y-3"
      >
        <div className="flex items-end gap-2">
          <label className="min-w-0 flex-1 text-xs text-stone-400">
            Name
            <Input
              value={combatant.name}
              disabled={!editable}
              onChange={(event) => onChange({ name: event.target.value })}
            />
          </label>
          <label className="text-xs text-stone-400">
            Type
            <select
              className="h-9 rounded-md border border-white/10 bg-[#151820] px-3 text-sm text-stone-100"
              value={combatant.kind}
              disabled={!editable}
              onChange={(event) =>
                onChange({ kind: event.target.value as V6Combatant["kind"] })
              }
            >
              <option value="monster">Monster / Combatant</option>
              <option value="npc">NPC</option>
              <option value="player">Player</option>
            </select>
          </label>
          {editable && (
            <Button
              size="icon"
              variant="ghost"
              aria-label={`Remove ${combatant.name}`}
              onClick={onRemove}
            >
              <Trash2 />
            </Button>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(
            [
              ["initiative", "Initiative"],
              ["hitPoints", "HP"],
              ["maximumHitPoints", "Maximum HP"],
              ["armorClass", "AC"],
            ] as const
          ).map(([field, label]) => (
            <label key={field} className="text-xs text-stone-400">
              {label}
              <Input
                type="number"
                min={
                  field === "maximumHitPoints" || field === "armorClass"
                    ? 0
                    : undefined
                }
                value={combatant[field]}
                disabled={!editable}
                onChange={(event) =>
                  onChange({ [field]: Number(event.target.value) })
                }
              />
            </label>
          ))}
        </div>
        <label className="block text-xs text-stone-400">
          Stat block, abilities, spells and notes
        </label>
        {editable ? (
          <RichTextEditor
            value={combatant.notes}
            onChange={(notes) => onChange({ notes })}
            onPasteImage={uploadV6Screenshot}
            placeholder="Speed, STR, DEX, CON, INT, WIS, CHA, actions, traits, spells and notes…"
            className="min-h-24"
          />
        ) : (
          <RichTextContent value={combatant.notes} />
        )}
        <Button size="sm" variant="outline" onClick={onToggle}>
          Collapse editor
        </Button>
      </div>
    </div>
  );
}
