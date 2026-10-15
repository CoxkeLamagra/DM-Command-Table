"use client";
import { useState } from "react";
import { Minus, Plus, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Combatant } from "@/domain/encounters";
type Props = {
  combatant: Combatant;
  editable: boolean;
  update: (part: Partial<Combatant>) => void;
};
export function HitPointControls({
  combatant,
  editable,
  update,
  adjustHp,
  undoHp,
  canUndoHp,
}: Props & {
  adjustHp: (amount: number, action: "damage" | "heal") => void;
  undoHp: () => void;
  canUndoHp: boolean;
}) {
  const [hpAmount, setHpAmount] = useState("1");
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
    <section
      aria-label="Hit points"
      className="mt-3 flex flex-wrap items-end gap-3"
    >
      <div className="flex flex-wrap items-end gap-2">
        <label className="block shrink-0 text-xs text-stone-400">
          HP
          <Input
            aria-label="Current hit points"
            className="mt-1 block h-9 w-20 text-center tabular-nums"
            type="number"
            value={combatant.hitPoints}
            disabled={!editable}
            onChange={(event) =>
              update({ hitPoints: Number(event.target.value) })
            }
          />
        </label>
        <span className="pb-2 text-stone-400">/</span>
        <label className="block shrink-0 text-xs text-stone-400">
          Max HP
          <Input
            aria-label="Maximum hit points"
            className="mt-1 block h-9 w-20 text-center tabular-nums"
            type="number"
            min={0}
            value={combatant.maximumHitPoints}
            disabled={!editable}
            onChange={(event) =>
              update({
                maximumHitPoints: Math.max(0, Number(event.target.value)),
              })
            }
          />
        </label>
        <span
          aria-label="Health percentage"
          className={`mb-1 shrink-0 whitespace-nowrap rounded px-2 py-1 text-xs font-semibold tabular-nums ${hpPercent >= 75 ? "bg-emerald-400/10 text-emerald-300" : hpPercent > 50 ? "bg-orange-400/10 text-orange-300" : "bg-red-400/10 text-red-300"}`}
        >
          {Number(hpPercent.toFixed(1))}% health
        </span>
      </div>
      {editable && (
        <div
          role="group"
          aria-label="HP adjustment"
          className="flex flex-wrap items-end gap-2"
        >
          <div className="flex items-end gap-1">
            <Button
              size="icon"
              variant="outline"
              aria-label="Damage"
              title="Apply damage"
              disabled={
                !Number.isFinite(Number(hpAmount)) || Number(hpAmount) <= 0
              }
              onClick={() => adjustHp(Number(hpAmount), "damage")}
            >
              <Minus />
            </Button>
            <label className="block shrink-0 text-xs text-stone-400">
              Amount ±
              <Input
                aria-label="Damage or healing amount"
                type="number"
                min="0"
                step="any"
                className="mt-1 block h-9 w-20 text-center tabular-nums"
                value={hpAmount}
                onChange={(event) => setHpAmount(event.target.value)}
              />
            </label>
            <Button
              size="icon"
              variant="outline"
              aria-label="Heal"
              title="Apply healing"
              disabled={
                !Number.isFinite(Number(hpAmount)) || Number(hpAmount) <= 0
              }
              onClick={() => adjustHp(Number(hpAmount), "heal")}
            >
              <Plus />
            </Button>
          </div>
          <Button
            size="icon"
            variant="ghost"
            aria-label="Undo HP change"
            title="Undo HP change"
            disabled={!canUndoHp}
            onClick={undoHp}
          >
            <Undo2 />
          </Button>
        </div>
      )}
    </section>
  );
}
