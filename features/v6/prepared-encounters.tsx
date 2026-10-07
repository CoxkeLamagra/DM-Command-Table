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
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  saveV6Combat,
  updatePreparedEncounter,
  uploadV6Screenshot,
} from "./api-client";
import type { V6Combatant, V6Monster, V6PreparedEncounter } from "./types";

export function PreparedEncounters({
  campaignId,
  sessionId,
  editable,
  onOpenCombat,
  registerSave,
}: {
  campaignId: string;
  sessionId: string;
  editable: boolean;
  onOpenCombat: () => void;
  registerSave?: (sessionId: string, saver: () => Promise<void>) => () => void;
}) {
  const [items, setItems] = useState<V6PreparedEncounter[]>([]);
  const itemsRef = useRef<V6PreparedEncounter[]>([]);
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [busy, setBusy] = useState(false);
  const [monsters, setMonsters] = useState<V6Monster[]>([]);
  const [addingTo, setAddingTo] = useState<string>();
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [query, setQuery] = useState("");

  useEffect(() => {
    let live = true;
    void Promise.all([
      listPreparedEncounters(campaignId, sessionId),
      listV6Monsters(campaignId),
    ])
      .then(([value, bestiary]) => {
        if (live) {
          setExpanded(new Set());
          setItems(value);
          itemsRef.current = value;
          setMonsters(bestiary);
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
    setBusy(true);
    try {
      const saved = await updatePreparedEncounter(campaignId, item);
      setItems((all) =>
        all.map((entry) => (entry.id === saved.id ? saved : entry)),
      );
      toast.success("Encounter saved");
    } catch (error) {
      report(error);
    } finally {
      setBusy(false);
    }
  }
  const saveAll = useCallback(async () => {
    setBusy(true);
    try {
      for (const item of itemsRef.current) {
        const saved = await updatePreparedEncounter(campaignId, item);
        itemsRef.current = itemsRef.current.map((entry) =>
          entry.id === saved.id ? saved : entry,
        );
        setItems(itemsRef.current);
      }
    } finally {
      setBusy(false);
    }
  }, [campaignId]);
  useEffect(
    () => registerSave?.(sessionId, saveAll),
    [registerSave, saveAll, sessionId],
  );
  async function remove(item: V6PreparedEncounter) {
    if (!window.confirm(`Delete ${item.name}?`)) return;
    setBusy(true);
    try {
      await deletePreparedEncounter(campaignId, item);
      setItems((all) => all.filter(({ id }) => id !== item.id));
    } catch (error) {
      report(error);
    } finally {
      setBusy(false);
    }
  }
  function patch(id: string, values: Partial<V6PreparedEncounter>) {
    setItems((all) =>
      all.map((item) => (item.id === id ? { ...item, ...values } : item)),
    );
  }
  function toggleEncounter(id: string) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  const allExpanded =
    items.length > 0 && items.every(({ id }) => expanded.has(id));

  function addCustom(item: V6PreparedEncounter, kind: "monster" | "npc") {
    const combatant: V6Combatant = {
      id: crypto.randomUUID(),
      playerId: null,
      monsterId: null,
      name: kind === "npc" ? "New NPC" : "New combatant",
      kind,
      displayNumber: null,
      initiative: 10,
      hitPoints: 10,
      maximumHitPoints: 10,
      armorClass: 10,
      notes: "",
      sortOrder: 0,
      conditions: [],
      revision: 1,
    };
    patch(item.id, { combatants: [...(item.combatants ?? []), combatant] });
  }
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
    patch(item.id, {
      monsters: item.monsters.filter(({ id }) => id !== entryId),
      combatants: [...(item.combatants ?? []), ...additions],
    });
  }

  function addChosen() {
    if (!addingTo) return;
    setItems((all) =>
      all.map((item) => {
        if (item.id !== addingTo) return item;
        const additions = [...chosen].map((monsterId, offset) => {
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
            quantity: quantities[monsterId] ?? 1,
            sortOrder: item.monsters.length + offset,
          };
        });
        return { ...item, monsters: [...item.monsters, ...additions] };
      }),
    );
    setAddingTo(undefined);
    setChosen(new Set());
    setQuantities({});
    setQuery("");
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
          ],
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
            <p className="rounded-lg border border-dashed border-white/10 p-4 text-sm text-stone-600">
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
                  <span className="shrink-0 text-xs text-stone-500">
                    Combatants (
                    {item.monsters.reduce(
                      (total, entry) => total + entry.quantity,
                      0,
                    ) + (item.combatants?.length ?? 0)}
                    )
                  </span>
                </button>
                <div
                  id={`encounter-details-${item.id}`}
                  hidden={!expanded.has(item.id)}
                  className="mt-3 border-t border-white/10 pt-3"
                >
                  <div className="flex gap-2">
                    <Input
                      value={item.name}
                      disabled={!editable}
                      onChange={(event) =>
                        patch(item.id, { name: event.target.value })
                      }
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      disabled={!editable || busy}
                      onClick={() => save(item)}
                    >
                      <Save />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      disabled={!editable || busy}
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
                    <p className="text-xs font-medium uppercase tracking-wider text-stone-500">
                      Monsters (
                      {item.monsters.reduce(
                        (total, entry) => total + entry.quantity,
                        0,
                      )}
                      )
                    </p>
                    {editable && (
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => addCustom(item, "npc")}
                        >
                          <Plus /> NPC
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => addCustom(item, "monster")}
                        >
                          <Plus /> Combatant
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setAddingTo(item.id)}
                        >
                          <Plus /> Bestiary
                        </Button>
                      </div>
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
                          <span className="text-xs text-stone-500">
                            × {entry.quantity}
                          </span>
                          {editable && (
                            <>
                              <Button
                                size="icon-xs"
                                variant="ghost"
                                aria-label={`Edit details for ${monster?.name ?? "monster"}`}
                                onClick={() => customizeMonster(item, entry.id)}
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
                      editable={editable}
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
              </div>
            ))
          )}
        </div>
      )}
      <Dialog
        open={!!addingTo}
        onOpenChange={(value) => {
          if (!value) {
            setAddingTo(undefined);
            setChosen(new Set());
            setQuantities({});
          }
        }}
      >
        <DialogContent className="border-white/10 bg-[#151820] text-stone-100">
          <DialogHeader>
            <DialogTitle>Add bestiary monsters</DialogTitle>
          </DialogHeader>
          <Input
            type="search"
            placeholder="Search by name, type, or CR…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <div className="max-h-72 space-y-1 overflow-y-auto">
            {monsters
              .filter((monster) =>
                `${monster.name} ${monster.type} ${monster.challengeRating}`
                  .toLowerCase()
                  .includes(query.toLowerCase()),
              )
              .map((monster) => {
                const checked = chosen.has(monster.id);
                return (
                  <div
                    key={monster.id}
                    className="flex items-center gap-3 rounded px-3 py-2 hover:bg-white/5"
                  >
                    <Checkbox
                      aria-label={`Select ${monster.name}`}
                      checked={checked}
                      onCheckedChange={(value) =>
                        setChosen((current) => {
                          const next = new Set(current);
                          if (value) next.add(monster.id);
                          else next.delete(monster.id);
                          return next;
                        })
                      }
                    />
                    <span className="min-w-0 flex-1 truncate">
                      {monster.name}
                    </span>
                    <span className="shrink-0 text-xs text-stone-500">
                      {monster.type} · CR {monster.challengeRating}
                    </span>
                    <Input
                      aria-label={`Quantity for ${monster.name}`}
                      title={`Quantity for ${monster.name}`}
                      className="h-8 w-20 text-center"
                      type="number"
                      min={1}
                      max={99}
                      value={quantities[monster.id] ?? 1}
                      onFocus={() =>
                        setChosen((current) => new Set(current).add(monster.id))
                      }
                      onChange={(event) => {
                        const quantity = Math.max(
                          1,
                          Math.min(
                            99,
                            Number.parseInt(event.target.value, 10) || 1,
                          ),
                        );
                        setQuantities((current) => ({
                          ...current,
                          [monster.id]: quantity,
                        }));
                        setChosen((current) =>
                          new Set(current).add(monster.id),
                        );
                      }}
                    />
                  </div>
                );
              })}
          </div>
          <Button disabled={!chosen.size} onClick={addChosen}>
            Add selected (
            {[...chosen].reduce(
              (total, id) => total + (quantities[id] ?? 1),
              0,
            )}
            )
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PreparedCombatantEditor({
  combatant,
  editable,
  onChange,
  onRemove,
}: {
  combatant: V6Combatant;
  editable: boolean;
  onChange: (value: Partial<V6Combatant>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="mt-3 space-y-3 rounded-lg border border-white/10 p-3">
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
    </div>
  );
}
