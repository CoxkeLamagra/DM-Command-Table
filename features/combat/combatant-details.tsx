"use client";

import { useState } from "react";
import { Minus, Plus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { createId } from "@/features/campaign/id";
import type { Combatant, Monster } from "@/features/campaign/types";
import { DetailSection, Stat } from "@/features/shared/ui";
import { NoteContent } from "@/features/screenshots/screenshot-notes";
import type { Screenshot } from "@/lib/api/screenshot-client";

const CONDITION_OPTIONS = [
  "Blinded", "Charmed", "Deafened", "Frightened", "Grappled",
  "Incapacitated", "Invisible", "Paralyzed", "Petrified", "Poisoned",
  "Prone", "Restrained", "Stunned", "Unconscious", "Concentrating",
];

export function HitPointEditor({
  combatant,
  update,
}: {
  combatant: Combatant;
  update: (part: Partial<Combatant>) => void;
}) {
  return (
    <div className="mt-5">
      <div className="mb-2 flex justify-between text-sm">
        <span className="text-stone-400">Hit points</span>
        <span>{combatant.hp} / {combatant.maxHp}</span>
      </div>
      <Progress value={Math.max(0, (combatant.hp / combatant.maxHp) * 100)} className="h-2.5 bg-white/10" />
      <div className="mt-3 flex items-center gap-2">
        <Button size="icon" variant="outline" className="border-white/10" onClick={() => update({ hp: Math.max(0, combatant.hp - 1) })}><Minus /></Button>
        <Input className="w-20 border-white/10 bg-black/20 text-center" type="number" value={combatant.hp} onChange={(event) => update({ hp: +event.target.value })} />
        <span className="text-stone-600">/</span>
        <Input aria-label="Maximum hit points" className="w-20 border-white/10 bg-black/20 text-center" type="number" value={combatant.maxHp} onChange={(event) => update({ maxHp: +event.target.value })} />
        <Button size="icon" variant="outline" className="border-white/10" onClick={() => update({ hp: Math.min(combatant.maxHp, combatant.hp + 1) })}><Plus /></Button>
      </div>
    </div>
  );
}

export function ConditionEditor({
  combatant,
  update,
}: {
  combatant: Combatant;
  update: (part: Partial<Combatant>) => void;
}) {
  const [name, setName] = useState("");
  const [duration, setDuration] = useState("");

  function addCondition() {
    const value = name.trim();
    if (value && !combatant.conditions.some((condition) => condition.name.toLowerCase() === value.toLowerCase())) {
      const parsedDuration = Number.parseInt(duration, 10);
      update({
        conditions: [...combatant.conditions, {
          id: createId(),
          name: value,
          remainingTurns: Number.isFinite(parsedDuration) && parsedDuration > 0 ? parsedDuration : null,
        }],
      });
    }
    setName("");
    setDuration("");
  }

  return (
    <section className="mt-6 border-t border-white/10 pt-5">
      <h3 className="font-serif text-lg text-amber-200">Status conditions</h3>
      <div className="mt-3 flex flex-wrap gap-2">
        {combatant.conditions.length ? combatant.conditions.map((condition) => (
          <Badge key={condition.id} className="gap-1 bg-violet-400/15 py-1.5 text-violet-200">
            {condition.name}
            {condition.remainingTurns !== null && <span className="text-violet-300/70">· {condition.remainingTurns} turn{condition.remainingTurns === 1 ? "" : "s"}</span>}
            <button aria-label={`Remove ${condition.name}`} onClick={() => update({ conditions: combatant.conditions.filter((entry) => entry.id !== condition.id) })}><X size={13} /></button>
          </Badge>
        )) : <span className="text-sm text-stone-600">No active conditions</span>}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Input list="condition-options" placeholder="Add a condition…" className="border-white/10 bg-black/20" value={name} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") addCondition(); }} />
        <datalist id="condition-options">{CONDITION_OPTIONS.map((option) => <option key={option} value={option} />)}</datalist>
        <Input aria-label="Condition duration in turns" title="Duration in turns (optional)" placeholder="Turns" className="w-24 border-white/10 bg-black/20" type="number" min="1" value={duration} onChange={(event) => setDuration(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") addCondition(); }} />
        <Button onClick={addCondition} variant="outline" className="border-white/10"><Plus /> Add</Button>
      </div>
    </section>
  );
}

export function MonsterStatBlock({
  monster,
  screenshots,
}: {
  monster: Monster | undefined;
  screenshots: Screenshot[];
}) {
  if (!monster) {
    return <div className="mt-6 rounded-lg border border-dashed border-white/10 p-6 text-center text-sm text-stone-500">No bestiary stat block linked to this combatant.</div>;
  }
  return (
    <div className="mt-6 border-t border-white/10 pt-5">
      <div className="mb-3">
        <h3 className="font-serif text-2xl text-amber-100">{monster.name}</h3>
        <p className="text-sm italic text-stone-500">{monster.type} · CR {monster.cr}</p>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Armor class" value={monster.ac} />
        <Stat label="Hit points" value={monster.hp} />
        <Stat label="Speed" value={monster.speed} />
      </div>
      <DetailSection title="Ability scores"><NoteContent value={monster.stats} screenshots={screenshots} /></DetailSection>
      <DetailSection title="Actions & traits"><NoteContent value={monster.abilities} screenshots={screenshots} /></DetailSection>
      <DetailSection title="Spellcasting">
        <NoteContent value={monster.spells} screenshots={screenshots} />
        <div className="mt-3 flex flex-wrap gap-2">
          {monster.slots.map((count, index) => <span key={index} className="rounded-md border border-violet-300/20 bg-violet-300/5 px-2 py-1 text-xs text-violet-200">Level {index + 1}: {count}</span>)}
        </div>
      </DetailSection>
    </div>
  );
}
