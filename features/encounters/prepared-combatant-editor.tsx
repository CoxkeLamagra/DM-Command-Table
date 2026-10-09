"use client";

import { ChevronDown, ChevronRight, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import {
  RichTextContent,
  RichTextEditor,
} from "@/features/rich-text/rich-text";
import { uploadScreenshot } from "@/features/shared/api-client";
import type { PreparedCombatant, Combatant } from "@/domain/types";

export function PreparedCombatantEditor({
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
                onChange({ kind: event.target.value as Combatant["kind"] })
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
            onPasteImage={uploadScreenshot}
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
