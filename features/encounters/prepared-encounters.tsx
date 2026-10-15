"use client";
import {
  ArrowUp,
  ArrowDown,
  GripVertical,
  ChevronDown,
  ChevronRight,
  ChevronsUpDown,
  Pencil,
  Play,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import { SaveStatus } from "../shared/save-status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CombatantPicker } from "../shared/combatant-picker";
import { EncounterSummary } from "./encounter-summary";
import { RichTextContent, RichTextEditor } from "../rich-text/rich-text";
import { uploadScreenshot } from "../shared/api";
import { LoadPreview } from "./load-preview";
import { PreparedCombatantEditor } from "./prepared-combatant-editor";
import { usePreparedEncounters } from "./use-prepared-encounters";
import type { PreparedEncountersProps } from "./prepared-types";
export function PreparedEncounters(props: PreparedEncountersProps) {
  const { editable, savingSession = false } = props;
  const {
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
  } = usePreparedEncounters(props);
  return (
    <div className="mt-5 border-t border-white/10 pt-4">
      {recovery.banner}
      <div className="flex flex-wrap items-center justify-between gap-2">
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
            <Button
              size="sm"
              variant="outline"
              disabled={busy || savingSession}
              onClick={add}
            >
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
            orderedItems.map((item, index) => (
              <div
                key={item.id}
                data-prepared-encounter={item.id}
                onDragOver={(event) => {
                  if (
                    dragging &&
                    !expanded.has(item.id) &&
                    !busy &&
                    !savingSession
                  ) {
                    event.preventDefault();
                    event.dataTransfer.dropEffect = "move";
                  }
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  if (dragging) void reorder(dragging, item.id);
                }}
                className="rounded-lg border border-white/10 bg-black/20 p-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  {editable && (
                    <div className="flex items-center">
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label={`Drag encounter ${item.name}`}
                        title="Drag collapsed encounter to reorder"
                        disabled={
                          busy || savingSession || expanded.has(item.id)
                        }
                        draggable={
                          !busy && !savingSession && !expanded.has(item.id)
                        }
                        onDragStart={(event) => {
                          event.dataTransfer.setData("text/plain", item.id);
                          event.dataTransfer.effectAllowed = "move";
                          setDragging(item.id);
                        }}
                        onDragEnd={() => setDragging(null)}
                      >
                        <GripVertical />
                      </Button>
                      <Button
                        size="icon-xs"
                        variant="ghost"
                        aria-label={`Move encounter ${item.name} up`}
                        disabled={
                          busy ||
                          savingSession ||
                          expanded.has(item.id) ||
                          index === 0 ||
                          expanded.has(orderedItems[index - 1]?.id)
                        }
                        onClick={() =>
                          reorder(item.id, orderedItems[index - 1].id)
                        }
                      >
                        <ArrowUp />
                      </Button>
                      <Button
                        size="icon-xs"
                        variant="ghost"
                        aria-label={`Move encounter ${item.name} down`}
                        disabled={
                          busy ||
                          savingSession ||
                          expanded.has(item.id) ||
                          index === orderedItems.length - 1 ||
                          expanded.has(orderedItems[index + 1]?.id)
                        }
                        onClick={() =>
                          reorder(item.id, orderedItems[index + 1].id)
                        }
                      >
                        <ArrowDown />
                      </Button>
                    </div>
                  )}
                  <button
                    type="button"
                    aria-expanded={expanded.has(item.id)}
                    aria-controls={`encounter-details-${item.id}`}
                    className="flex min-w-0 flex-1 basis-40 items-center gap-2 text-left"
                    onClick={() => toggleEncounter(item.id)}
                  >
                    {expanded.has(item.id) ? (
                      <ChevronDown className="size-4 shrink-0" />
                    ) : (
                      <ChevronRight className="size-4 shrink-0" />
                    )}
                    <span className="shrink-0 text-sm font-semibold tabular-nums text-amber-200">
                      {index + 1}.
                    </span>
                    <span className="min-w-0 flex-1 truncate font-medium">
                      {item.name || "Untitled encounter"}
                    </span>
                    <SaveStatus
                      dirty={dirty.has(item.id)}
                      saving={savingSession || savingEncounter === item.id}
                      label={`Encounter ${item.name}`}
                    />
                  </button>
                  <div className="flex items-center gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      disabled={!editable || busy || savingSession}
                      aria-label={`Save encounter ${item.name}`}
                      title="Save this encounter"
                      onClick={() => save(item)}
                    >
                      <Save />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      disabled={!editable || busy || savingSession}
                      aria-label={`Delete encounter ${item.name}`}
                      onClick={() => remove(item)}
                    >
                      <Trash2 />
                    </Button>
                    {editable && (
                      <Button
                        size="sm"
                        variant="outline"
                        aria-label={`Load encounter ${item.name}`}
                        disabled={
                          (!item.monsters.length && !item.combatants?.length) ||
                          busy ||
                          savingSession
                        }
                        onClick={() => loadInCombat(item)}
                      >
                        <Play /> Load encounter
                      </Button>
                    )}
                  </div>
                </div>
                <EncounterSummary
                  encounter={item}
                  monstersById={monstersById}
                />
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
                    </div>
                    <div className="mt-3">
                      {editable ? (
                        <RichTextEditor
                          value={item.notes}
                          onChange={(notes) => patch(item.id, { notes })}
                          onPasteImage={uploadScreenshot}
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
                        const monster = monstersById.get(entry.monsterId);
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
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
      {preview && (
        <LoadPreview
          prepared={preview.prepared}
          combat={preview.combat}
          busy={busy}
          unsaved={dirty.has(preview.prepared.id)}
          onClose={() => setPreview(null)}
          onConfirm={() => void confirmLoad()}
          onRefresh={() => void loadInCombat(preview.prepared)}
        />
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
