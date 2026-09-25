"use client";

import { Input } from "@/components/ui/input";
import { ScreenshotNotes } from "@/features/screenshots/screenshot-notes";
import type { Screenshot } from "@/lib/api/screenshot-client";
import type { CampaignPlayer } from "./types";

export function PlayerEditor({
  player,
  screenshots,
  upload,
  update,
  compact = false,
}: {
  player: CampaignPlayer;
  screenshots: Screenshot[];
  upload: (file: File) => Promise<Screenshot>;
  update: (part: Partial<CampaignPlayer>) => void;
  compact?: boolean;
}) {
  const numericFields = (
    <div className="mt-3 grid grid-cols-3 gap-3">
      <NumberField label="Level" value={player.level} min={1} max={20} defaultOnBlur={compact ? undefined : 1} update={(level) => update({ level })} />
      <NumberField label="Hit points" value={player.hp} min={0} placeholder="Not set" update={(hp) => update({ hp })} />
      <NumberField label="Armor class" value={player.ac} min={0} placeholder="Not set" update={(ac) => update({ ac })} />
    </div>
  );
  return (
    <>
      <div className={`grid gap-3 ${compact ? "sm:grid-cols-2" : "grid-cols-2"}`}>
        <TextField label="Player name" value={player.name} update={(name) => update({ name })} />
        <TextField label="Race" value={player.race} placeholder="e.g. Human" update={(race) => update({ race })} />
        <TextField label="Class" value={player.className} placeholder="e.g. Paladin" update={(className) => update({ className })} />
      </div>
      {numericFields}
      <section className="mt-4 text-xs text-stone-500">
        <p>Player notes</p>
        <div className="mt-1">
          <ScreenshotNotes
            className={compact ? "min-h-32" : "min-h-28"}
            placeholder="Background, abilities, reminders, or campaign notes…"
            value={player.notes}
            onChange={(notes) => update({ notes })}
            screenshots={screenshots}
            upload={upload}
          />
        </div>
      </section>
    </>
  );
}

function TextField({ label, value, placeholder, update }: { label: string; value: string; placeholder?: string; update: (value: string) => void }) {
  return (
    <label className="text-xs text-stone-500">
      {label}
      <Input className="mt-1 border-white/10 bg-black/20" placeholder={placeholder} value={value} onChange={(event) => update(event.target.value)} />
    </label>
  );
}

function NumberField({ label, value, min, max, placeholder, defaultOnBlur, update }: { label: string; value: number | null; min: number; max?: number; placeholder?: string; defaultOnBlur?: number; update: (value: number | null) => void }) {
  return (
    <label className="text-xs text-stone-500">
      {label}
      <Input min={min} max={max} className="mt-1 border-white/10 bg-black/20" type="number" placeholder={placeholder} value={value ?? ""} onChange={(event) => update(event.target.value === "" ? null : Math.min(max ?? Number.POSITIVE_INFINITY, Math.max(min, +event.target.value)))} onBlur={() => { if (value === null && defaultOnBlur !== undefined) update(defaultOnBlur); }} />
    </label>
  );
}
