"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { emptyRuntime } from "@/domain/combat-runtime";
import type {
  Combatant,
  CombatResource,
  CombatRuntime,
} from "@/domain/encounters";
export function RuntimeControls({
  combatant,
  editable,
  update,
}: {
  combatant: Combatant;
  editable: boolean;
  update: (part: Partial<Combatant>) => void;
}) {
  const runtime = combatant.runtime ?? emptyRuntime();
  const [name, setName] = useState("");
  const [maximum, setMaximum] = useState("1");
  const [reset, setReset] = useState<CombatResource["reset"]>("manual");
  function patch(part: Partial<CombatRuntime>) {
    update({ runtime: { ...runtime, ...part } });
  }
  function resource(id: string, part: Partial<CombatResource>) {
    patch({
      resources: runtime.resources.map((value) =>
        value.id === id ? { ...value, ...part } : value,
      ),
    });
  }
  function add(
    label: string,
    count: number,
    recovery: CombatResource["reset"],
  ) {
    if (
      !label.trim() ||
      !Number.isInteger(count) ||
      count < 0 ||
      count > 10000 ||
      runtime.resources.length >= 100
    )
      return;
    patch({
      resources: [
        ...runtime.resources,
        {
          id: crypto.randomUUID(),
          name: label.trim(),
          maximum: count,
          remaining: count,
          reset: recovery,
        },
      ],
    });
    setName("");
  }
  return (
    <section
      aria-label="Combat resources"
      className="mt-6 space-y-4 border-t border-white/10 pt-5"
    >
      <h3 className="font-serif text-lg text-amber-200">
        Live combat resources
      </h3>
      <p className="text-xs text-stone-400">
        Tracked for this combatant only. Rolls, saving throws and rest recovery
        are resolved manually.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          Temporary HP
          <Input
            aria-label="Temporary hit points"
            type="number"
            min={0}
            value={runtime.temporaryHitPoints}
            disabled={!editable}
            onChange={(event) =>
              patch({
                temporaryHitPoints: Math.max(0, Number(event.target.value)),
              })
            }
          />
        </label>
        <label className="text-sm">
          Concentration
          <Input
            aria-label="Concentration"
            placeholder="Spell or effect"
            maxLength={200}
            value={runtime.concentration ?? ""}
            disabled={!editable}
            onChange={(event) =>
              patch({
                concentration: event.target.value.trim()
                  ? event.target.value
                  : null,
              })
            }
          />
        </label>
      </div>
      {runtime.concentration && (
        <p role="status" className="text-sm text-violet-200">
          Concentrating on {runtime.concentration}. Resolve checks and clear
          concentration manually.
        </p>
      )}
      <fieldset className="rounded-lg border border-white/10 p-3">
        <legend className="px-1 text-sm">Death saves</legend>
        <div className="flex flex-wrap gap-4">
          {(["successes", "failures"] as const).map((kind) => (
            <label key={kind} className="text-sm capitalize">
              {kind}
              <select
                aria-label={`Death save ${kind}`}
                className="ml-2 rounded border border-white/10 bg-[#191d27] p-2"
                value={runtime.deathSaves[kind]}
                disabled={!editable}
                onChange={(event) =>
                  patch({
                    deathSaves: {
                      ...runtime.deathSaves,
                      [kind]: Number(event.target.value),
                    },
                  })
                }
              >
                {[0, 1, 2, 3].map((count) => (
                  <option key={count} value={count}>
                    {count}
                  </option>
                ))}
              </select>
            </label>
          ))}
          <Button
            variant="ghost"
            disabled={!editable}
            onClick={() => patch({ deathSaves: { successes: 0, failures: 0 } })}
          >
            Reset death saves
          </Button>
        </div>
        {(runtime.deathSaves.failures === 3 ||
          runtime.deathSaves.successes === 3) && (
          <p role="status" className="mt-2 text-sm text-amber-200">
            {runtime.deathSaves.failures === 3
              ? "Three failures recorded: check whether this creature has died."
              : "Three successes recorded: check whether this creature is stable."}
          </p>
        )}
      </fieldset>
      <div className="space-y-3">
        {runtime.resources.map((value) => (
          <div key={value.id} className="rounded-lg border border-white/10 p-3">
            <div className="flex flex-wrap items-end gap-2">
              <label className="min-w-32 flex-1 text-xs">
                Resource
                <Input
                  aria-label="Resource name"
                  maxLength={120}
                  value={value.name}
                  disabled={!editable}
                  onChange={(event) =>
                    resource(value.id, { name: event.target.value })
                  }
                />
              </label>
              <label className="text-xs">
                Remaining
                <Input
                  aria-label={`${value.name} remaining`}
                  type="number"
                  min={0}
                  max={value.maximum}
                  className="w-20"
                  value={value.remaining}
                  disabled={!editable}
                  onChange={(event) =>
                    resource(value.id, {
                      remaining: Math.max(
                        0,
                        Math.min(
                          value.maximum,
                          Math.trunc(Number(event.target.value)),
                        ),
                      ),
                    })
                  }
                />
              </label>
              <label className="text-xs">
                Maximum
                <Input
                  aria-label={`${value.name} maximum`}
                  type="number"
                  min={0}
                  max={10000}
                  className="w-20"
                  value={value.maximum}
                  disabled={!editable}
                  onChange={(event) => {
                    const count = Math.max(
                      0,
                      Math.min(10000, Math.trunc(Number(event.target.value))),
                    );
                    resource(value.id, {
                      maximum: count,
                      remaining: Math.min(count, value.remaining),
                    });
                  }}
                />
              </label>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                disabled={!editable || value.remaining === 0}
                onClick={() =>
                  resource(value.id, { remaining: value.remaining - 1 })
                }
              >
                Use {value.name}
              </Button>
              <Button
                variant="ghost"
                disabled={!editable || value.remaining === value.maximum}
                onClick={() => resource(value.id, { remaining: value.maximum })}
              >
                Restore {value.name}
              </Button>
              <select
                aria-label={`${value.name} reset timing`}
                value={value.reset}
                disabled={!editable}
                className="rounded border border-white/10 bg-[#191d27] p-2 text-xs"
                onChange={(event) =>
                  resource(value.id, {
                    reset: event.target.value as CombatResource["reset"],
                  })
                }
              >
                <option value="manual">Manual recovery</option>
                <option value="start-turn">Reset at start of own turn</option>
              </select>
              <Button
                variant="ghost"
                disabled={!editable}
                onClick={() =>
                  patch({
                    resources: runtime.resources.filter(
                      (entry) => entry.id !== value.id,
                    ),
                  })
                }
              >
                Remove {value.name}
              </Button>
            </div>
          </div>
        ))}
      </div>
      {editable && (
        <div className="space-y-2">
          <Button
            variant="outline"
            disabled={runtime.resources.length >= 100}
            onClick={() => add("Legendary actions", 3, "start-turn")}
          >
            Add legendary actions
          </Button>
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex-1 text-xs">
              New resource
              <Input
                aria-label="New resource name"
                maxLength={120}
                placeholder="Ability, legendary resistance, spell slots…"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            <label className="text-xs">
              Uses
              <Input
                aria-label="New resource uses"
                type="number"
                min={0}
                max={10000}
                className="w-20"
                value={maximum}
                onChange={(event) => setMaximum(event.target.value)}
              />
            </label>
            <select
              aria-label="New resource recovery"
              className="rounded border border-white/10 bg-[#191d27] p-2 text-sm"
              value={reset}
              onChange={(event) =>
                setReset(event.target.value as CombatResource["reset"])
              }
            >
              <option value="manual">Manual recovery</option>
              <option value="start-turn">Own turn</option>
            </select>
            <Button
              variant="outline"
              disabled={
                !name.trim() ||
                runtime.resources.length >= 100 ||
                maximum === "" ||
                !Number.isInteger(Number(maximum)) ||
                Number(maximum) < 0 ||
                Number(maximum) > 10000
              }
              onClick={() => add(name, Number(maximum), reset)}
            >
              Add resource
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
