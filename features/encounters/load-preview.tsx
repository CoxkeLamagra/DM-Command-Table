"use client";
import { useState } from "react";
import type { Combat, PreparedEncounter } from "@/domain/types";
import { previewPreparation } from "@/domain/encounter-preview";
import { MAX_COMBATANTS } from "@/domain/limits";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
export function LoadPreview({
  prepared,
  combat,
  busy,
  unsaved,
  onClose,
  onConfirm,
  onRefresh,
}: {
  prepared: PreparedEncounter;
  combat: Combat;
  busy: boolean;
  unsaved: boolean;
  onClose: () => void;
  onConfirm: (preservePlayersAndNpcs: boolean) => void;
  onRefresh: () => void;
}) {
  const hasParty = combat.combatants.some(({ kind }) => kind !== "monster");
  const [preserve, setPreserve] = useState<boolean | null>(null);
  const preview = previewPreparation(combat, prepared, preserve === true);
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent className="max-h-[85vh] overflow-y-auto border-white/10 bg-[#151820] text-stone-100 sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Load encounter preview</DialogTitle>
          <DialogDescription>
            Load “{prepared.name || "Prepared encounter"}” into Combat. The{" "}
            {preserve === true
              ? "current monsters are replaced and active Players/NPCs are preserved."
              : "entire current roster is replaced."}{" "}
            The round resets to 1 and the initiative order is rebuilt.
          </DialogDescription>
        </DialogHeader>
        {hasParty && (
          <fieldset className="space-y-2 rounded border border-amber-300/30 p-3">
            <legend className="px-1 font-medium">
              Preserve active Players and NPCs?
            </legend>
            <label className="flex items-center gap-2 text-sm">
              <input
                className="accent-amber-300"
                type="radio"
                name="preserve-party"
                checked={preserve === true}
                onChange={() => setPreserve(true)}
                disabled={busy}
              />
              Yes — keep active Players/NPCs and load only prepared monsters
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                className="accent-amber-300"
                type="radio"
                name="preserve-party"
                checked={preserve === false}
                onChange={() => setPreserve(false)}
                disabled={busy}
              />
              No — replace everyone with all prepared combatants
            </label>
          </fieldset>
        )}
        {preview.retained.length > 0 && (
          <section>
            <h3 className="font-medium text-emerald-300">
              Retain {preview.retained.length} active Players/NPCs
            </h3>
            <p className="text-sm text-stone-300">
              Their current HP, conditions and resources are preserved. Prepared
              Players/NPCs are skipped.
            </p>
          </section>
        )}
        {unsaved && (
          <p className="rounded bg-amber-300/10 p-3 text-sm text-amber-200">
            This preview uses your unsaved encounter edits. Loading does not
            save the prepared encounter.
          </p>
        )}
        <section>
          <h3 className="font-medium text-red-300">
            Replace {preview.replaced.length} current combatants
          </h3>
          <p className="text-sm text-stone-300">
            {preview.replaced
              .slice(0, 12)
              .map(({ name }) => name)
              .join(", ") || "None"}
            {preview.replaced.length > 12
              ? ` and ${preview.replaced.length - 12} more`
              : ""}
            .
          </p>
        </section>
        <section>
          <h3 className="font-medium">
            Add {preview.monsterCount + preview.customCount} combatants
          </h3>
          <p className="text-sm text-stone-300">
            {preview.monsterCount} Bestiary monsters and {preview.customCount}{" "}
            {preserve === true
              ? "prepared custom monsters"
              : "prepared Players, NPCs or custom monsters"}
            . Prepared copies start with no conditions.
          </p>
        </section>
        {preview.mergedPlayers > 0 && (
          <p className="text-sm text-stone-300">
            {preview.mergedPlayers} duplicate Player entries will be replaced by
            the last prepared entry with that name. Monsters and NPCs remain
            separate.
          </p>
        )}
        <p className="font-medium">
          Result: {preview.total.toLocaleString()} combatants
        </p>
        {preview.total > MAX_COMBATANTS && (
          <p role="alert" className="text-red-300">
            The result exceeds the 10,000-combatant limit. Reduce the encounter
            before loading.
          </p>
        )}
        <p className="text-xs text-stone-400">
          Based on saved Combat revision {combat.revision}. A concurrent change
          will require a refreshed preview.
        </p>
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="ghost" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button variant="outline" disabled={busy} onClick={onRefresh}>
            Refresh preview
          </Button>
          <Button
            disabled={
              busy ||
              (hasParty && preserve === null) ||
              preview.total > MAX_COMBATANTS
            }
            onClick={() => onConfirm(preserve === true)}
          >
            {busy ? "Loading…" : "Confirm load"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
