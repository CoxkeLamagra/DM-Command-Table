"use client";

import { MonsterStatBlock as VisualMonsterStatBlock } from "@/features/bestiary/monster-stat-block";
import { HitPointControls } from "./hit-point-controls";
import { ConditionsEditor } from "./conditions-editor";
import { RuntimeControls } from "./runtime-controls";
import type { CombatSnapshot } from "@/domain/encounters";

import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";

import { Input } from "@/components/ui/input";
import {
  RichTextContent,
  RichTextEditor,
} from "@/features/rich-text/rich-text";
import { uploadScreenshot } from "@/features/shared/api";
import type { Combatant } from "@/domain/types";

export function CombatantEditor({
  combatant,
  editable,
  update,
  remove,
  adjustHp,
  undoHp,
  canUndoHp,
}: {
  combatant?: Combatant;
  editable: boolean;
  update: (part: Partial<Combatant>) => void;
  remove: () => void;
  adjustHp: (amount: number, action: "damage" | "heal") => void;
  undoHp: () => void;
  canUndoHp: boolean;
}) {
  if (!combatant)
    return (
      <div className="rounded-xl border border-dashed border-white/10 p-12 text-center text-stone-400">
        Add a combatant to begin.
      </div>
    );
  return (
    <aside className="rounded-xl border border-white/10 bg-[#13161d] p-4 xl:self-start">
      <div className="flex items-start gap-2">
        <Input
          className="h-9 min-w-0 flex-1 font-serif text-lg text-amber-100"
          aria-label="Combatant name"
          value={combatant.name}
          disabled={!editable}
          onFocus={(event) => event.currentTarget.select()}
          onChange={(event) => update({ name: event.target.value })}
        />
        {combatant.kind !== "player" && (
          <Input
            aria-label="Combatant number"
            className="h-9 w-16 shrink-0 text-center font-serif"
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
            className="text-stone-400 hover:text-red-300"
            onClick={remove}
          >
            <Trash2 />
          </Button>
        )}
      </div>
      <div className="mt-3 grid grid-cols-[minmax(0,1fr)_5rem_5rem] gap-2">
        <label className="text-xs text-stone-400">
          Type
          <select
            className={`mt-1 h-9 w-full rounded-md border border-white/10 bg-[#191d27] px-2 text-sm font-medium ${combatantKindText(combatant.kind)}`}
            value={combatant.kind}
            disabled={!editable || !!combatant.playerId}
            onChange={(event) =>
              update({ kind: event.target.value as Combatant["kind"] })
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
      <HitPointControls
        combatant={combatant}
        editable={editable}
        update={update}
        adjustHp={adjustHp}
        undoHp={undoHp}
        canUndoHp={canUndoHp}
      />
      <ConditionsEditor
        combatant={combatant}
        editable={editable}
        update={update}
      />
      {combatant.kind === "monster" && (
        <details open className="my-3">
          <summary className="cursor-pointer text-sm text-amber-200">
            Visual stat block
          </summary>
          <MonsterStatBlock monster={combatant.snapshot ?? undefined} />
        </details>
      )}
      <RuntimeControls
        combatant={combatant}
        editable={editable}
        update={update}
      />
      <div className="mt-5">
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-stone-400">
          Encounter notes
        </p>
        {editable ? (
          <RichTextEditor
            value={combatant.notes}
            onChange={(notes) => update({ notes })}
            onPasteImage={uploadScreenshot}
            placeholder="Notes for this combatant in the current encounter…"
            className="min-h-28"
          />
        ) : combatant.notes ? (
          <RichTextContent value={combatant.notes} />
        ) : (
          <p className="text-sm text-stone-400">No encounter notes.</p>
        )}
      </div>
    </aside>
  );
}

function MonsterStatBlock({ monster }: { monster?: CombatSnapshot }) {
  if (!monster)
    return (
      <div className="mt-6 rounded-lg border border-dashed border-white/10 p-6 text-center text-sm text-stone-400">
        This one-time monster has no captured Bestiary stat block. Use encounter
        notes for its details.
      </div>
    );
  return (
    <VisualMonsterStatBlock
      monster={monster}
      caption="Encounter snapshot · Bestiary edits do not change this stat block."
    />
  );
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
    <label className="text-xs text-stone-400">
      {label}
      <Input
        className="mt-1 h-9 text-center tabular-nums"
        type="number"
        value={value}
        disabled={disabled}
        onChange={(event) => change(Number(event.target.value))}
      />
    </label>
  );
}

function combatantKindText(kind: Combatant["kind"]) {
  return kind === "player"
    ? "text-emerald-300"
    : kind === "monster"
      ? "text-red-300"
      : "text-blue-300";
}
