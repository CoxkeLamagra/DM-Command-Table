"use client";

import { useState } from "react";

import { DropdownMenu } from "radix-ui";
import { ChevronDown, Minus, Plus, Trash2, Undo2 } from "lucide-react";

import { Button } from "@/components/ui/button";

import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  ConditionIcon,
  DEFAULT_CONDITIONS,
} from "@/features/combat/condition-icons";
import {
  RichTextContent,
  RichTextEditor,
} from "@/features/rich-text/rich-text";
import { DetailSection, Stat } from "@/features/shared/ui";
import { uploadScreenshot } from "@/features/shared/api-client";
import type { Combatant, Monster } from "@/domain/types";

export function CombatantEditor({
  combatant,
  monster,
  editable,
  update,
  remove,
  adjustHp,
  undoHp,
  canUndoHp,
}: {
  combatant?: Combatant;
  monster?: Monster;
  editable: boolean;
  update: (part: Partial<Combatant>) => void;
  remove: () => void;
  adjustHp: (amount: number, action: "damage" | "heal") => void;
  undoHp: () => void;
  canUndoHp: boolean;
}) {
  const [condition, setCondition] = useState("Poisoned");
  const [duration, setDuration] = useState("");
  const [hpAmount, setHpAmount] = useState("");
  if (!combatant)
    return (
      <div className="rounded-xl border border-dashed border-white/10 p-12 text-center text-stone-400">
        Add a combatant to begin.
      </div>
    );
  const current = combatant;
  function addCondition() {
    const name = condition.trim();
    if (!name) return;
    update({
      conditions: [
        ...current.conditions,
        {
          id: crypto.randomUUID(),
          name,
          remainingTurns: duration ? Math.max(1, Number(duration)) : null,
        },
      ],
    });
    setDuration("");
  }
  const hpPercent =
    combatant.maximumHitPoints > 0
      ? Math.max(
          0,
          Math.min(
            100,
            (combatant.hitPoints / combatant.maximumHitPoints) * 100,
          ),
        )
      : 0;
  return (
    <aside className="rounded-xl border border-white/10 bg-[#13161d] p-5 xl:self-start">
      <div className="flex items-start gap-2">
        <Input
          className="h-11 min-w-0 flex-1 font-serif text-lg text-amber-100"
          aria-label="Combatant name"
          value={combatant.name}
          disabled={!editable}
          onFocus={(event) => event.currentTarget.select()}
          onChange={(event) => update({ name: event.target.value })}
        />
        {combatant.kind !== "player" && (
          <Input
            aria-label="Combatant number"
            className="h-11 w-24 text-center font-serif"
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
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <label className="text-xs text-stone-400">
          Type
          <select
            className={`mt-1 h-10 w-full rounded-md border border-white/10 bg-[#191d27] px-2 text-sm font-medium ${combatantKindText(combatant.kind)}`}
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
      <section className="mt-5">
        <div className="mb-2 flex justify-between text-sm">
          <span className="text-stone-400">Hit points</span>
          <span>
            {combatant.hitPoints} / {combatant.maximumHitPoints}
          </span>
        </div>
        <Progress value={hpPercent} className="h-2.5 bg-white/10" />
        {editable && (
          <div className="mt-3 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <label className="text-xs text-stone-400">
                Amount
                <Input
                  aria-label="Damage or healing amount"
                  type="number"
                  min="0"
                  step="any"
                  className="mt-1 w-24"
                  value={hpAmount}
                  onChange={(event) => setHpAmount(event.target.value)}
                />
              </label>
              <Button
                variant="outline"
                disabled={
                  !Number.isFinite(Number(hpAmount)) || Number(hpAmount) <= 0
                }
                onClick={() => adjustHp(Number(hpAmount), "damage")}
              >
                Damage
              </Button>
              <Button
                variant="outline"
                disabled={
                  !Number.isFinite(Number(hpAmount)) || Number(hpAmount) <= 0
                }
                onClick={() => adjustHp(Number(hpAmount), "heal")}
              >
                Heal
              </Button>
              <Button variant="ghost" disabled={!canUndoHp} onClick={undoHp}>
                <Undo2 /> Undo HP change
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="icon"
                variant="outline"
                onClick={() =>
                  update({ hitPoints: Math.max(0, combatant.hitPoints - 1) })
                }
              >
                <Minus />
              </Button>
              <Input
                aria-label="Current hit points"
                className="w-20 text-center"
                type="number"
                value={combatant.hitPoints}
                onChange={(event) =>
                  update({ hitPoints: Number(event.target.value) })
                }
              />
              <span className="text-stone-400">/</span>
              <Input
                aria-label="Maximum hit points"
                className="w-20 text-center"
                type="number"
                min={0}
                value={combatant.maximumHitPoints}
                onChange={(event) =>
                  update({
                    maximumHitPoints: Math.max(0, Number(event.target.value)),
                  })
                }
              />
              <Button
                size="icon"
                variant="outline"
                onClick={() =>
                  update({
                    hitPoints: Math.min(
                      combatant.maximumHitPoints,
                      combatant.hitPoints + 1,
                    ),
                  })
                }
              >
                <Plus />
              </Button>
            </div>
          </div>
        )}
      </section>
      <section className="mt-6 border-t border-white/10 pt-5">
        <h3 className="font-serif text-lg text-amber-200">Status conditions</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          {combatant.conditions.length ? (
            combatant.conditions.map((entry) => (
              <button
                key={entry.id}
                disabled={!editable}
                onClick={() =>
                  update({
                    conditions: combatant.conditions.filter(
                      ({ id }) => id !== entry.id,
                    ),
                  })
                }
                className="flex items-center gap-1.5 rounded-full bg-violet-400/15 px-3 py-1.5 text-xs text-violet-200"
              >
                <ConditionIcon name={entry.name} />
                {entry.name}
                {entry.remainingTurns !== null &&
                  ` · ${entry.remainingTurns} turn${entry.remainingTurns === 1 ? "" : "s"}`}
              </button>
            ))
          ) : (
            <span className="text-sm text-stone-400">No active conditions</span>
          )}
        </div>
        {editable && (
          <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_7rem_auto]">
            <div className="flex min-w-0 gap-1">
              <Input
                aria-label="Condition name"
                maxLength={120}
                placeholder="Choose or type a condition…"
                value={condition}
                onChange={(event) => setCondition(event.target.value)}
              />
              <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    aria-label="Choose a default condition"
                  >
                    <ChevronDown />
                  </Button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content
                    sideOffset={4}
                    align="end"
                    aria-label="Default conditions"
                    className="z-50 max-h-72 min-w-48 overflow-y-auto rounded-md border border-white/10 bg-[#151820] p-1 text-stone-100 shadow-lg"
                  >
                    {DEFAULT_CONDITIONS.map((name) => (
                      <DropdownMenu.Item
                        key={name}
                        onSelect={() => setCondition(name)}
                        className="flex cursor-pointer items-center gap-2 rounded px-3 py-2 text-sm outline-none data-[highlighted]:bg-white/10"
                      >
                        <ConditionIcon name={name} /> {name}
                      </DropdownMenu.Item>
                    ))}
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
            </div>
            <Input
              type="number"
              min={1}
              placeholder="Turns"
              value={duration}
              onChange={(event) => setDuration(event.target.value)}
            />
            <Button variant="outline" onClick={addCondition}>
              <Plus /> Add
            </Button>
          </div>
        )}
      </section>
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
      {combatant.kind === "monster" && <MonsterStatBlock monster={monster} />}
    </aside>
  );
}

function MonsterStatBlock({ monster }: { monster?: Monster }) {
  if (!monster)
    return (
      <div className="mt-6 rounded-lg border border-dashed border-white/10 p-6 text-center text-sm text-stone-400">
        This one-time monster has no linked Bestiary stat block.
      </div>
    );
  const slots = monster.spellSlots
    .map((count, index) => ({ level: index + 1, count }))
    .filter(({ count }) => count > 0);
  return (
    <section className="mt-6 border-t border-white/10 pt-5">
      <div className="mb-4">
        <h3 className="font-serif text-2xl text-amber-100">{monster.name}</h3>
        <p className="text-sm italic text-stone-400">
          {monster.type || "Unknown type"} · CR {monster.challengeRating || "—"}
          {monster.source ? ` · ${monster.source}` : ""}
        </p>
        {!!monster.tags.length && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {monster.tags.map((tag) => (
              <span
                key={tag.id}
                className="rounded-full border border-white/10 px-2 py-0.5 text-xs text-stone-400"
                style={
                  tag.color
                    ? { borderColor: tag.color, color: tag.color }
                    : undefined
                }
              >
                {tag.name}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Armor class" value={monster.armorClass} />
        <Stat label="Hit points" value={monster.hitPoints} />
        <Stat label="Speed" value={monster.speed || "—"} />
      </div>
      <MonsterDetail title="Ability scores" value={monster.stats} />
      <MonsterDetail title="Actions & traits" value={monster.abilities} />
      <DetailSection title="Spellcasting">
        {monster.spells ? (
          <RichTextContent value={monster.spells} />
        ) : (
          <p className="text-stone-400">
            No spellcasting information recorded.
          </p>
        )}
        {!!slots.length && (
          <div className="mt-3 flex flex-wrap gap-2">
            {slots.map(({ level, count }) => (
              <span
                key={level}
                className="rounded-md border border-violet-300/20 bg-violet-300/5 px-2 py-1 text-xs text-violet-200"
              >
                Level {level}: {count} slot{count === 1 ? "" : "s"}
              </span>
            ))}
          </div>
        )}
      </DetailSection>
      {!!monster.notes && <MonsterDetail title="Notes" value={monster.notes} />}
    </section>
  );
}

function MonsterDetail({ title, value }: { title: string; value: string }) {
  return (
    <DetailSection title={title}>
      {value ? (
        <RichTextContent value={value} />
      ) : (
        <p className="text-stone-400">No information recorded.</p>
      )}
    </DetailSection>
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
        className="mt-1"
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
