"use client";
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
  onConfirm: () => void;
  onRefresh: () => void;
}) {
  const preview = previewPreparation(combat, prepared);
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
            Load “{prepared.name || "Prepared encounter"}” into Combat. The
            entire current roster is replaced. The round resets to 1 and the
            initiative order is rebuilt.
          </DialogDescription>
        </DialogHeader>
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
            prepared Players, NPCs or custom monsters. Prepared copies start
            with no conditions.
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
            disabled={busy || preview.total > MAX_COMBATANTS}
            onClick={onConfirm}
          >
            {busy ? "Loading…" : "Confirm load"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
