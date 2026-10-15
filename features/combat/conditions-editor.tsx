"use client";
import { useState } from "react";
import { DropdownMenu } from "radix-ui";
import { ChevronDown, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConditionIcon, DEFAULT_CONDITIONS } from "./condition-icons";
import type { CombatCondition, Combatant } from "@/domain/encounters";
type Props = {
  combatant: Combatant;
  editable: boolean;
  update: (part: Partial<Combatant>) => void;
};
export function ConditionsEditor({ combatant, editable, update }: Props) {
  const [condition, setCondition] = useState("Poisoned");
  const [duration, setDuration] = useState("");
  const [timing, setTiming] =
    useState<NonNullable<CombatCondition["timing"]>>("start-turn");
  const [requiresSave, setRequiresSave] = useState(false);
  const current = combatant;
  function addCondition() {
    const name = condition.trim();
    if (
      !name ||
      current.conditions.length >= 100 ||
      (timing !== "manual" &&
        duration &&
        (!Number.isInteger(Number(duration)) || Number(duration) < 1))
    )
      return;
    update({
      conditions: [
        ...current.conditions,
        {
          id: crypto.randomUUID(),
          name,
          remainingTurns:
            timing !== "manual" && duration
              ? Math.max(1, Number(duration))
              : null,
          timing,
          requiresSave,
          saveDue: false,
        },
      ],
    });
    setDuration("");
  }
  return (
    <>
      <section className="mt-4 border-t border-white/10 pt-3">
        <h3 className="font-serif text-lg text-amber-200">Status conditions</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          {combatant.conditions.length ? (
            combatant.conditions.map((entry) => (
              <div
                key={entry.id}
                className="w-full rounded-lg bg-violet-400/10 p-3 text-sm text-violet-200"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <ConditionIcon name={entry.name} />
                  <strong>{entry.name}</strong>
                  <span>
                    {entry.remainingTurns === null
                      ? entry.requiresSave
                        ? "Until resolved"
                        : "Until dismissed"
                      : `${entry.remainingTurns} turn(s)`}{" "}
                    ·{" "}
                    {
                      {
                        "start-turn": "Start of own turn",
                        "end-turn": "End of own turn",
                        manual: "Manual",
                      }[
                        entry.timing ??
                          (entry.remainingTurns === null
                            ? "manual"
                            : "start-turn")
                      ]
                    }
                    {entry.requiresSave ? " · Requires save" : ""}
                  </span>
                  <Button
                    variant="ghost"
                    disabled={!editable}
                    onClick={() =>
                      update({
                        conditions: current.conditions.filter(
                          (value) => value.id !== entry.id,
                        ),
                      })
                    }
                  >
                    Clear {entry.name}
                  </Button>
                </div>
                {entry.requiresSave && !entry.saveDue && (
                  <Button
                    variant="outline"
                    disabled={!editable}
                    onClick={() =>
                      update({
                        conditions: current.conditions.map((value) =>
                          value.id === entry.id
                            ? { ...value, saveDue: true }
                            : value,
                        ),
                      })
                    }
                  >
                    Mark save due for {entry.name}
                  </Button>
                )}
                {entry.saveDue && (
                  <div
                    role="status"
                    className="mt-2 flex flex-wrap items-center gap-2"
                  >
                    <span>Saving throw due. Resolve manually.</span>
                    <Button
                      variant="outline"
                      disabled={!editable}
                      onClick={() =>
                        update({
                          conditions: current.conditions.filter(
                            (value) => value.id !== entry.id,
                          ),
                        })
                      }
                    >
                      Save succeeded: clear {entry.name}
                    </Button>
                    <Button
                      variant="outline"
                      disabled={!editable}
                      onClick={() =>
                        update({
                          conditions: current.conditions.map((value) =>
                            value.id === entry.id
                              ? { ...value, saveDue: false }
                              : value,
                          ),
                        })
                      }
                    >
                      Save failed: keep {entry.name}
                    </Button>
                  </div>
                )}
                {editable && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs">
                      Override timing or duration
                    </summary>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <select
                        aria-label={`${entry.name} timing`}
                        className="rounded border border-white/10 bg-[#191d27] p-2"
                        value={
                          entry.timing ??
                          (entry.remainingTurns === null
                            ? "manual"
                            : "start-turn")
                        }
                        onChange={(event) =>
                          update({
                            conditions: current.conditions.map((value) =>
                              value.id === entry.id
                                ? {
                                    ...value,
                                    timing: event.target
                                      .value as CombatCondition["timing"],
                                    remainingTurns:
                                      event.target.value === "manual"
                                        ? null
                                        : value.remainingTurns,
                                    saveDue: false,
                                  }
                                : value,
                            ),
                          })
                        }
                      >
                        <option value="start-turn">Start of own turn</option>
                        <option value="end-turn">End of own turn</option>
                        <option value="manual">Until dismissed / manual</option>
                      </select>
                      <Input
                        aria-label={`${entry.name} remaining turns`}
                        type="number"
                        min={1}
                        className="w-24"
                        placeholder="Indefinite"
                        disabled={entry.timing === "manual"}
                        value={entry.remainingTurns ?? ""}
                        onChange={(event) =>
                          update({
                            conditions: current.conditions.map((value) =>
                              value.id === entry.id
                                ? {
                                    ...value,
                                    remainingTurns:
                                      event.target.value === ""
                                        ? null
                                        : Math.max(
                                            1,
                                            Math.trunc(
                                              Number(event.target.value),
                                            ),
                                          ),
                                    saveDue: false,
                                  }
                                : value,
                            ),
                          })
                        }
                      />
                      <label>
                        <input
                          type="checkbox"
                          checked={!!entry.requiresSave}
                          onChange={(event) =>
                            update({
                              conditions: current.conditions.map((value) =>
                                value.id === entry.id
                                  ? {
                                      ...value,
                                      requiresSave: event.target.checked,
                                      saveDue: false,
                                    }
                                  : value,
                              ),
                            })
                          }
                        />{" "}
                        Requires save
                      </label>
                    </div>
                  </details>
                )}
              </div>
            ))
          ) : (
            <span className="text-sm text-stone-400">No active conditions</span>
          )}
        </div>
        {editable && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
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
              aria-label="Condition duration"
              disabled={timing === "manual"}
              className="w-24"
              placeholder="Turns"
              value={duration}
              onChange={(event) => setDuration(event.target.value)}
            />
            <select
              aria-label="Condition timing"
              className="rounded border border-white/10 bg-[#191d27] p-2 text-sm"
              value={timing}
              onChange={(event) =>
                setTiming(
                  event.target.value as NonNullable<CombatCondition["timing"]>,
                )
              }
            >
              <option value="start-turn">Start of own turn</option>
              <option value="end-turn">End of own turn</option>
              <option value="manual">Until dismissed / manual</option>
            </select>
            <label className="text-sm">
              <input
                type="checkbox"
                checked={requiresSave}
                onChange={(event) => setRequiresSave(event.target.checked)}
              />{" "}
              Requires save
            </label>
            <Button
              variant="outline"
              disabled={
                current.conditions.length >= 100 ||
                !condition.trim() ||
                (timing !== "manual" &&
                  duration !== "" &&
                  (!Number.isInteger(Number(duration)) || Number(duration) < 1))
              }
              onClick={addCondition}
            >
              <Plus /> Add
            </Button>
          </div>
        )}
      </section>
      <p className="mt-2 text-xs text-stone-400">
        Durations count this creature’s selected turn boundary. Saves are
        flagged, never rolled automatically. Blank duration persists until
        cleared.
      </p>
    </>
  );
}
