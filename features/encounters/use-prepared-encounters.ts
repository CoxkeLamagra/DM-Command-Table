"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { reconcileSaved } from "./drafts";
import { useDraftRecovery } from "../shared/draft-recovery";
import { useUnsavedChanges } from "../shared/unsaved-changes";
import type { PreparedEncountersProps } from "./prepared-types";
import type {
  PreparedEncounter,
  PreparedCombatant,
  Combatant,
  Monster,
  Player,
  Combat,
} from "@/domain/types";
import type { CombatantSelection } from "../shared/combatant-picker";
import {
  createPreparedEncounter,
  deletePreparedEncounter,
  getCombat,
  listPreparedEncounters,
  listMonsters,
  listPlayers,
  loadPreparedCombat,
  updatePreparedEncounter,
  reorderPreparedEncounters,
} from "../shared/api";
export function usePreparedEncounters({
  campaignId,
  sessionId,
  editable,
  onOpenCombat,
  registerSave,
  onDirtyChange,
  onCountChange,
  savingSession = false,
}: PreparedEncountersProps) {
  const [preview, setPreview] = useState<{
    prepared: PreparedEncounter;
    combat: Combat;
  } | null>(null);
  const [items, setItems] = useState<PreparedEncounter[]>([]);
  useEffect(() => {
    onCountChange?.(sessionId, items.length);
  }, [onCountChange, sessionId, items.length]);
  const itemsRef = useRef<PreparedEncounter[]>([]);
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
  const [loaded, setLoaded] = useState(false);
  const recovery = useDraftRecovery({
    campaignId,
    scope: `prepared:${sessionId}`,
    value: items.filter(({ id }) => dirty.has(id)),
    dirty: dirty.size > 0,
    ready: loaded && editable,
    restore: (values) => {
      if (
        !Array.isArray(values) ||
        values.some(
          (value) =>
            typeof value?.id !== "string" || !Array.isArray(value.monsters),
        )
      )
        throw new Error("Invalid draft");
      if (values.some((value) => !items.some(({ id }) => id === value.id)))
        throw new Error(
          "An encounter was removed. Download the draft to recover it.",
        );
      setItems((all) =>
        all.map((item) => values.find(({ id }) => id === item.id) ?? item),
      );
      const ids = values.map(({ id }) => id);
      setDirty(new Set(ids));
      setExpanded(new Set(ids));
      setVisited(new Set(ids));
      setOpen(true);
    },
  });
  const [visited, setVisited] = useState<Set<string>>(() => new Set());
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState<string | null>(null);
  const orderedItems = useMemo(
    () =>
      [...items].sort(
        (a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id),
      ),
    [items],
  );
  const [monsters, setMonsters] = useState<Monster[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const monstersById = useMemo(
    () => new Map(monsters.map((monster) => [monster.id, monster])),
    [monsters],
  );
  const [addingTo, setAddingTo] = useState<string>();

  useEffect(() => {
    let live = true;
    void Promise.all([
      listPreparedEncounters(campaignId, sessionId),
      listMonsters(campaignId),
      listPlayers(campaignId),
    ])
      .then(([value, bestiary, characters]) => {
        if (live) {
          setExpanded(new Set());
          setItems(value);
          setLoaded(true);
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
        Math.max(-1, ...items.map(({ sortOrder }) => sortOrder)) + 1,
      );
      setItems((all) => [...all, item]);
      setExpanded((ids) => new Set(ids).add(item.id));
      setVisited((ids) => new Set(ids).add(item.id));
      setOpen(true);
    } catch (error) {
      report(error);
    } finally {
      setBusy(false);
    }
  }
  async function reorder(fromId: string, toId: string) {
    setDragging(null);
    if (
      !editable ||
      busy ||
      savingSession ||
      fromId === toId ||
      expanded.has(fromId) ||
      expanded.has(toId)
    )
      return;
    const order = [...orderedItems];
    const from = order.findIndex(({ id }) => id === fromId),
      to = order.findIndex(({ id }) => id === toId);
    if (from < 0 || to < 0) return;
    order.splice(to, 0, order.splice(from, 1)[0]);
    setBusy(true);
    try {
      const saved = await reorderPreparedEncounters(
        campaignId,
        sessionId,
        order.map(({ id, revision }) => ({ id, revision })),
      );
      const byId = new Map(saved.map((item) => [item.id, item]));
      setItems((all) =>
        all.map((item) => {
          const result = byId.get(item.id);
          return result
            ? {
                ...item,
                sortOrder: result.sortOrder,
                revision: result.revision,
                updatedAt: result.updatedAt,
              }
            : item;
        }),
      );
      toast.success("Encounter order saved");
    } catch (error) {
      report(error);
    } finally {
      setBusy(false);
    }
  }
  async function save(item: PreparedEncounter) {
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
    (submitted: PreparedEncounter[], saved: PreparedEncounter[]) => {
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
  async function remove(item: PreparedEncounter) {
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
  function patch(id: string, values: Partial<PreparedEncounter>) {
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

  function customizeMonster(item: PreparedEncounter, entryId: string) {
    const entry = item.monsters.find(({ id }) => id === entryId);
    const monster = entry ? monstersById.get(entry.monsterId) : undefined;
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
    const additions: Combatant[] = Array.from(
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
  async function loadInCombat(item: PreparedEncounter) {
    setBusy(true);
    try {
      setPreview({ prepared: item, combat: await getCombat(campaignId) });
    } catch (error) {
      report(error);
    } finally {
      setBusy(false);
    }
  }
  async function confirmLoad(preservePlayersAndNpcs: boolean) {
    if (!preview || busy) return;
    setBusy(true);
    try {
      await loadPreparedCombat(
        campaignId,
        preview.prepared,
        preview.combat.revision,
        preservePlayersAndNpcs,
      );
      setPreview(null);
      toast.success("Prepared encounter loaded");
      onOpenCombat();
    } catch (error) {
      report(error);
    } finally {
      setBusy(false);
    }
  }

  return {
    recovery,
    open,
    setOpen,
    items,
    orderedItems,
    allExpanded,
    setVisited,
    setExpanded,
    busy,
    add,
    dragging,
    reorder,
    setDragging,
    expanded,
    toggleEncounter,
    dirty,
    savingEncounter,
    save,
    remove,
    monsters,
    monstersById,
    visited,
    patch,
    setAddingTo,
    customizeMonster,
    editingCombatants,
    setEditingCombatants,
    addingTo,
    players,
    addChosen,
    preview,
    confirmLoad,
    setPreview,
    loadInCombat,
  };
}
