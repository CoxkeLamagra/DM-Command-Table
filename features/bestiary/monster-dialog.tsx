"use client";

import type { ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { Monster } from "@/features/campaign/types";
import { DetailSection, Stat } from "@/features/shared/ui";

export function MonsterDialog({
  monster,
  trigger,
  update,
}: {
  monster?: Monster;
  trigger: ReactNode;
  update?: (part: Partial<Monster>) => void;
}) {
  if (!monster)
    return <span className="text-xs text-stone-600">No stat block</span>;

  if (update) {
    return (
      <Dialog>
        <DialogTrigger asChild>{trigger}</DialogTrigger>
        <DialogContent className="max-h-[88vh] overflow-y-auto border-amber-300/20 bg-[#12161e] text-stone-100 sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-serif text-3xl text-amber-100">
              Edit monster stat block
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs text-stone-500">
              Name
              <Input
                className="mt-1 border-white/10 bg-black/20 font-serif text-lg text-amber-100"
                value={monster.name}
                onChange={(event) => update({ name: event.target.value })}
              />
            </label>
            <label className="text-xs text-stone-500">
              Creature type
              <Input
                className="mt-1 border-white/10 bg-black/20"
                value={monster.type}
                onChange={(event) => update({ type: event.target.value })}
              />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <label className="text-xs text-stone-500">
              Challenge rating
              <Input
                className="mt-1 border-white/10 bg-black/20"
                value={monster.cr}
                onChange={(event) => update({ cr: event.target.value })}
              />
            </label>
            <label className="text-xs text-stone-500">
              Armor class
              <Input
                min="0"
                className="mt-1 border-white/10 bg-black/20"
                type="number"
                value={monster.ac}
                onChange={(event) =>
                  update({ ac: Math.max(0, +event.target.value) })
                }
              />
            </label>
            <label className="text-xs text-stone-500">
              Hit points
              <Input
                min="0"
                className="mt-1 border-white/10 bg-black/20"
                type="number"
                value={monster.hp}
                onChange={(event) =>
                  update({ hp: Math.max(0, +event.target.value) })
                }
              />
            </label>
            <label className="text-xs text-stone-500">
              Speed
              <Input
                className="mt-1 border-white/10 bg-black/20"
                value={monster.speed}
                onChange={(event) => update({ speed: event.target.value })}
              />
            </label>
          </div>
          <label className="text-xs text-stone-500">
            Ability scores
            <Textarea
              className="mt-1 min-h-20 border-white/10 bg-black/20"
              value={monster.stats}
              onChange={(event) => update({ stats: event.target.value })}
            />
          </label>
          <label className="text-xs text-stone-500">
            Actions &amp; traits
            <Textarea
              className="mt-1 min-h-36 border-white/10 bg-black/20"
              value={monster.abilities}
              onChange={(event) => update({ abilities: event.target.value })}
            />
          </label>
          <label className="text-xs text-stone-500">
            Spellcasting
            <Textarea
              className="mt-1 min-h-28 border-white/10 bg-black/20"
              value={monster.spells}
              onChange={(event) => update({ spells: event.target.value })}
            />
          </label>
          <section>
            <p className="text-xs text-stone-500">Spell slots</p>
            <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-5">
              {monster.slots.map((count, index) => (
                <label key={index} className="text-xs text-stone-500">
                  Level {index + 1}
                  <Input
                    min="0"
                    className="mt-1 border-white/10 bg-black/20 text-center"
                    type="number"
                    value={count}
                    onChange={(event) => {
                      const slots = [...monster.slots];
                      slots[index] = Math.max(0, +event.target.value);
                      update({ slots });
                    }}
                  />
                </label>
              ))}
            </div>
          </section>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[88vh] overflow-y-auto border-amber-300/20 bg-[#12161e] text-stone-100 sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-serif text-3xl text-amber-100">
            {monster.name}
          </DialogTitle>
          <p className="text-sm italic text-stone-500">
            {monster.type} · CR {monster.cr}
          </p>
        </DialogHeader>
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Armor class" value={monster.ac} />
          <Stat label="Hit points" value={monster.hp} />
          <Stat label="Speed" value={monster.speed} />
        </div>
        <DetailSection title="Ability scores">{monster.stats}</DetailSection>
        <DetailSection title="Actions & traits">
          {monster.abilities}
        </DetailSection>
        <DetailSection title="Spellcasting">
          {monster.spells}
          <div className="mt-3 flex flex-wrap gap-3">
            {monster.slots.map((count, index) => (
              <span
                key={index}
                className="rounded-md border border-violet-300/20 bg-violet-300/5 px-2 py-1 text-xs text-violet-200"
              >
                Level {index + 1}: {count} slots
              </span>
            ))}
          </div>
        </DetailSection>
      </DialogContent>
    </Dialog>
  );
}
