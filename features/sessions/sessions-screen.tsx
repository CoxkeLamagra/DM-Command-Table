"use client";

import {
  Check,
  ChevronRight,
  Play,
  Plus,
  Swords,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScreenTitle } from "@/features/shared/ui";
import { ScreenshotNotes } from "@/features/screenshots/screenshot-notes";
import { useScreenshotLibrary } from "@/features/screenshots/use-screenshot-library";
import {
  addPreparedMonster,
  createPreparedEncounter,
  createSessionNote,
} from "./domain";
import { createId } from "@/features/campaign/id";
import type {
  CampaignPatch,
  CampaignState,
  PreparedEncounter,
  PreparedEncounterMonster,
  SessionNote,
} from "@/features/campaign/types";

const uid = createId;

export function Sessions({
  data,
  patch,
  loadEncounter,
}: {
  data: CampaignState;
  patch: CampaignPatch;
  loadEncounter: (encounter: PreparedEncounter) => void;
}) {
  const { screenshots, upload } = useScreenshotLibrary();
  const update = (id: string, part: Partial<SessionNote>) =>
    patch(
      "sessions",
      data.sessions.map((session) =>
        session.id === id ? { ...session, ...part } : session,
      ),
    );
  const addSession = () =>
    patch("sessions", [
      createSessionNote(uid, new Date().toISOString().slice(0, 10)),
      ...data.sessions,
    ]);
  const updateEncounter = (
    session: SessionNote,
    encounterId: string,
    part: Partial<PreparedEncounter>,
  ) =>
    update(session.id, {
      encounters: session.encounters.map((encounter) =>
        encounter.id === encounterId ? { ...encounter, ...part } : encounter,
      ),
    });
  const addEncounter = (session: SessionNote) =>
    update(session.id, {
      encounters: [
        ...session.encounters,
        createPreparedEncounter(session.encounters.length, uid),
      ],
    });
  const deleteEncounter = (
    session: SessionNote,
    encounter: PreparedEncounter,
  ) => {
    if (!window.confirm(`Delete prepared encounter "${encounter.name}"?`))
      return;
    update(session.id, {
      encounters: session.encounters.filter((item) => item.id !== encounter.id),
    });
    toast.success("Prepared encounter deleted");
  };
  const addMonster = (
    session: SessionNote,
    encounter: PreparedEncounter,
    monsterId: string,
  ) => {
    if (!monsterId) return;
    updateEncounter(session, encounter.id, {
      monsters: [
        ...encounter.monsters,
        addPreparedMonster(encounter, monsterId, uid),
      ],
    });
  };
  const updatePreparedMonster = (
    session: SessionNote,
    encounter: PreparedEncounter,
    entryId: string,
    part: Partial<PreparedEncounterMonster>,
  ) =>
    updateEncounter(session, encounter.id, {
      monsters: encounter.monsters.map((entry) =>
        entry.id === entryId ? { ...entry, ...part } : entry,
      ),
    });
  const removeMonster = (
    session: SessionNote,
    encounter: PreparedEncounter,
    entryId: string,
  ) =>
    updateEncounter(session, encounter.id, {
      monsters: encounter.monsters.filter((entry) => entry.id !== entryId),
    });
  return (
    <>
      <ScreenTitle
        eyebrow="Preparation & recap"
        title="Session notes"
        action={
          <Button
            onClick={addSession}
            className="bg-amber-300 text-black hover:bg-amber-200"
          >
            <Plus /> New session
          </Button>
        }
      />
      <div className="space-y-5">
        {data.sessions.map((session) => (
          <article
            id={`session-${session.id}`}
            tabIndex={-1}
            key={session.id}
            className={`scroll-mt-24 rounded-xl border p-5 outline-none transition focus:ring-2 focus:ring-amber-300/60 ${session.done ? "border-emerald-300/15 bg-emerald-300/[.03]" : "border-white/10 bg-[#12161e]"}`}
          >
            <div className="flex gap-3">
              <button
                onClick={() => update(session.id, { done: !session.done })}
                className={`mt-1 grid h-6 w-6 shrink-0 place-items-center rounded-full border ${session.done ? "border-emerald-300 bg-emerald-300 text-black" : "border-white/20"}`}
                aria-label="Mark session complete"
              >
                {session.done && <Check size={15} />}
              </button>
              <div className="min-w-0 flex-1">
                <Input
                  className="border-0 bg-transparent px-0 font-serif text-xl text-amber-100"
                  value={session.title}
                  onChange={(e) =>
                    update(session.id, { title: e.target.value })
                  }
                />
                <Input
                  type="date"
                  className="mt-1 h-8 w-40 border-white/10 bg-black/20 text-xs"
                  value={session.date}
                  onChange={(e) => update(session.id, { date: e.target.value })}
                />
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="text-stone-600 hover:text-red-300"
                onClick={() =>
                  patch(
                    "sessions",
                    data.sessions.filter((item) => item.id !== session.id),
                  )
                }
                aria-label={`Delete ${session.title}`}
              >
                <Trash2 />
              </Button>
            </div>
            <div className="mt-4">
            <ScreenshotNotes
              className="min-h-40"
              placeholder="Scenes, NPC motivations, clues, treasure, reminders…"
              value={session.body}
              onChange={(body) => update(session.id, { body })}
              screenshots={screenshots}
              upload={upload}
            />
            </div>
            <details className="group mt-5 border-t border-white/10 pt-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-lg px-2 py-1 transition hover:bg-white/[.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/60">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[.18em] text-amber-300/70">
                    Prepared combat
                  </p>
                  <h3 className="mt-1 flex items-center gap-2 font-serif text-xl text-stone-200">
                    Encounters{" "}
                    <span className="rounded-full border border-white/10 bg-black/20 px-2 py-0.5 font-sans text-xs text-stone-400">
                      {session.encounters.length}
                    </span>
                  </h3>
                </div>
                <ChevronRight className="text-stone-500 transition-transform group-open:rotate-90" />
              </summary>
              <div className="pt-4">
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-white/15 bg-transparent hover:bg-white/5"
                    onClick={() => addEncounter(session)}
                  >
                    <Plus /> Add encounter
                  </Button>
                </div>
                {session.encounters.length ? (
                  <div className="mt-4 grid gap-4 xl:grid-cols-2">
                    {session.encounters.map((encounter) => (
                      <article
                        key={encounter.id}
                        className="rounded-xl border border-white/10 bg-black/20 p-4"
                      >
                        <div className="flex items-start gap-2">
                          <Input
                            aria-label="Encounter name"
                            className="border-white/10 bg-[#12161e] font-serif text-lg text-amber-100"
                            value={encounter.name}
                            onChange={(e) =>
                              updateEncounter(session, encounter.id, {
                                name: e.target.value,
                              })
                            }
                          />
                          <Button
                            size="icon"
                            variant="ghost"
                            className="shrink-0 text-stone-600 hover:text-red-300"
                            onClick={() => deleteEncounter(session, encounter)}
                            aria-label={`Delete ${encounter.name}`}
                          >
                            <Trash2 />
                          </Button>
                        </div>
                        <div className="mt-3 flex gap-2">
                          <select
                            aria-label={`Add monster to ${encounter.name}`}
                            value=""
                            onChange={(e) =>
                              addMonster(session, encounter, e.target.value)
                            }
                            className="h-9 min-w-0 flex-1 rounded-md border border-white/10 bg-[#12161e] px-3 text-sm text-stone-300"
                          >
                            <option value="">Add a Bestiary monster…</option>
                            {data.monsters.map((monster) => (
                              <option key={monster.id} value={monster.id}>
                                {monster.name} · CR {monster.cr}
                              </option>
                            ))}
                          </select>
                        </div>
                        {encounter.monsters.length ? (
                          <div className="mt-3 space-y-2">
                            {encounter.monsters.map((reference) => {
                              const monster = data.monsters.find(
                                (entry) => entry.id === reference.monsterId,
                              );
                              return (
                                <div
                                  key={reference.id}
                                  className="flex items-center gap-3 rounded-lg border border-white/10 bg-[#12161e] px-3 py-2"
                                >
                                  <label className="w-16 shrink-0">
                                    <span className="sr-only">
                                      Monster number
                                    </span>
                                    <Input
                                      aria-label={`${monster?.name ?? "Monster"} number`}
                                      className="h-8 border-white/10 bg-black/20 px-1 text-center text-sm text-red-200"
                                      type="number"
                                      min="1"
                                      placeholder="#"
                                      value={reference.number ?? ""}
                                      onChange={(e) =>
                                        updatePreparedMonster(
                                          session,
                                          encounter,
                                          reference.id,
                                          {
                                            number:
                                              e.target.value === ""
                                                ? null
                                                : Math.max(1, +e.target.value),
                                          },
                                        )
                                      }
                                    />
                                  </label>
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-medium text-stone-200">
                                      {monster?.name ??
                                        "Missing Bestiary monster"}
                                      {reference.number != null
                                        ? ` #${reference.number}`
                                        : ""}
                                    </p>
                                    <p className="text-xs text-stone-500">
                                      {monster
                                        ? `CR ${monster.cr} · HP ${monster.hp} · AC ${monster.ac}`
                                        : "This monster was removed from the Bestiary."}
                                    </p>
                                  </div>
                                  <Button
                                    size="icon-sm"
                                    variant="ghost"
                                    className="text-stone-600 hover:text-red-300"
                                    onClick={() =>
                                      removeMonster(
                                        session,
                                        encounter,
                                        reference.id,
                                      )
                                    }
                                    aria-label={`Remove ${monster?.name ?? "monster"}`}
                                  >
                                    <X />
                                  </Button>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="mt-3 rounded-lg border border-dashed border-white/10 p-4 text-center text-xs text-stone-600">
                            No monsters prepared yet.
                          </p>
                        )}
                        <Button
                          className="mt-4 w-full bg-amber-300 text-black hover:bg-amber-200"
                          disabled={
                            !encounter.monsters.some((reference) =>
                              data.monsters.some(
                                (monster) => monster.id === reference.monsterId,
                              ),
                            )
                          }
                          onClick={() => loadEncounter(encounter)}
                        >
                          <Play /> Load in Combat
                        </Button>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="mt-4 rounded-xl border border-dashed border-white/10 p-6 text-center">
                    <Swords className="mx-auto text-stone-600" />
                    <p className="mt-2 text-sm text-stone-500">
                      Prepare one or more encounters for this session.
                    </p>
                  </div>
                )}
              </div>
            </details>
          </article>
        ))}
      </div>
    </>
  );
}
