"use client";

import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import type { CampaignPlayer, Combatant } from "@/features/campaign/types";
import { ConditionIcon } from "./condition-icons";

const colors = {
  monster: { dot: "bg-red-400", border: "border-red-400/45", bg: "bg-red-400/[.07]", text: "text-red-300" },
  player: { dot: "bg-emerald-400", border: "border-emerald-400/45", bg: "bg-emerald-400/[.07]", text: "text-emerald-300" },
  npc: { dot: "bg-sky-400", border: "border-sky-400/45", bg: "bg-sky-400/[.07]", text: "text-sky-300" },
};

export function InitiativeList({
  combatants,
  players,
  turn,
  selectedId,
  select,
}: {
  combatants: Combatant[];
  players: CampaignPlayer[];
  turn: number;
  selectedId: string | undefined;
  select: (id: string) => void;
}) {
  return (
    <section className="space-y-2" aria-label="Initiative tracker">
      {combatants.map((combatant, index) => {
        const tone = colors[combatant.kind];
        const down = combatant.hp <= 0;
        const player = players.find((entry) => entry.id === combatant.campaignPlayerId);
        const playerDetails = [player?.race, player?.className].filter(Boolean).join(" · ");
        return (
          <button key={combatant.id} onClick={() => select(combatant.id)} className={`grid w-full grid-cols-[44px_1fr_auto] items-center gap-3 rounded-xl border p-3 text-left transition ${down ? "border-red-500/50 bg-red-950/20" : selectedId === combatant.id ? `${tone.border} ${tone.bg}` : "border-white/10 bg-[#12161e] hover:border-white/20"} ${selectedId === combatant.id && down ? "ring-1 ring-red-400/40" : ""}`}>
            <span className={`grid h-10 w-10 place-items-center rounded-full bg-black/25 font-serif text-lg ${down ? "text-red-300" : tone.text}`}>{combatant.initiative}</span>
            <span className="min-w-0">
              <span className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full ${down ? "bg-red-500" : tone.dot}`} />
                <span className={`truncate font-medium ${down ? "text-stone-400 line-through decoration-red-400/70" : ""}`}>
                  {combatant.name}{combatant.kind !== "player" && combatant.number != null ? ` #${combatant.number}` : ""}
                </span>
                {combatant.conditions.length > 0 && (
                  <span className="flex shrink-0 items-center gap-1 rounded-md border border-violet-400/20 bg-violet-400/10 px-1.5 py-1 text-violet-300" aria-label={`Conditions: ${combatant.conditions.map((condition) => condition.name).join(", ")}`} title={combatant.conditions.map((condition) => condition.name).join(", ")}>
                    {combatant.conditions.slice(0, 3).map((condition) => <ConditionIcon key={condition.id} name={condition.name} size={13} />)}
                    {combatant.conditions.length > 3 && <span className="text-[10px] font-semibold">+{combatant.conditions.length - 3}</span>}
                  </span>
                )}
                {down && <Badge className="border border-red-400/30 bg-red-500/15 text-red-200">Down · 0 HP</Badge>}
                {index === turn && <Badge className="bg-amber-300/15 text-amber-200">Turn</Badge>}
              </span>
              <span className="mt-1 block truncate text-xs text-stone-500">
                {playerDetails ? `${playerDetails} · ` : ""}{combatant.kind.charAt(0).toUpperCase() + combatant.kind.slice(1)} · AC {combatant.ac}
                {combatant.conditions.length ? ` · ${combatant.conditions.map((condition) => condition.remainingTurns === null ? condition.name : `${condition.name} (${condition.remainingTurns})`).join(", ")}` : ""}
              </span>
            </span>
            <span className="text-right text-xs">
              <span className={`block ${down ? "font-semibold text-red-300" : "text-stone-300"}`}>{combatant.hp}/{combatant.maxHp} HP</span>
              <Progress value={Math.max(0, (combatant.hp / combatant.maxHp) * 100)} className="mt-2 h-1.5 w-20 bg-white/10" />
            </span>
          </button>
        );
      })}
    </section>
  );
}
