"use client";

import { Check, Link2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScreenTitle } from "@/features/shared/ui";
import { ScreenshotNotes } from "@/features/screenshots/screenshot-notes";
import { useScreenshotLibrary } from "@/features/screenshots/use-screenshot-library";
import { createSessionNote } from "./domain";
import { createId } from "@/features/campaign/id";
import type { CampaignPatch, CampaignState, PreparedEncounter, SessionNote } from "@/features/campaign/types";
import { removeSessionFromStory } from "@/features/story/domain";
import { PreparedEncounters } from "./prepared-encounters";

export function Sessions({
  data,
  patch,
  loadEncounter,
  openStory,
}: {
  data: CampaignState;
  patch: CampaignPatch;
  loadEncounter: (encounter: PreparedEncounter) => void;
  openStory: (id: string) => void;
}) {
  const { screenshots, upload } = useScreenshotLibrary();
  function update(id: string, part: Partial<SessionNote>) {
    patch("sessions", data.sessions.map((session) => session.id === id ? { ...session, ...part } : session));
  }
  function addSession() {
    patch("sessions", [createSessionNote(createId, new Date().toISOString().slice(0, 10)), ...data.sessions]);
  }
  function deleteSession(session: SessionNote) {
    patch("sessions", data.sessions.filter((item) => item.id !== session.id));
    patch("story", removeSessionFromStory(data.story, session.id));
  }

  return (
    <>
      <ScreenTitle eyebrow="Preparation & recap" title="Session notes" action={<Button onClick={addSession} className="bg-amber-300 text-black hover:bg-amber-200"><Plus /> New session</Button>} />
      <div className="space-y-5">
        {data.sessions.map((session) => {
          const linkedStories = data.story.filter((beat) => beat.sessionIds.includes(session.id));
          return (
            <article id={`session-${session.id}`} tabIndex={-1} key={session.id} className={`scroll-mt-24 rounded-xl border p-5 outline-none transition focus:ring-2 focus:ring-amber-300/60 ${session.done ? "border-emerald-300/15 bg-emerald-300/[.03]" : "border-white/10 bg-[#12161e]"}`}>
              <div className="flex gap-3">
                <button onClick={() => update(session.id, { done: !session.done })} className={`mt-1 grid h-6 w-6 shrink-0 place-items-center rounded-full border ${session.done ? "border-emerald-300 bg-emerald-300 text-black" : "border-white/20"}`} aria-label="Mark session complete">
                  {session.done && <Check size={15} />}
                </button>
                <div className="min-w-0 flex-1">
                  <Input className="border-0 bg-transparent px-0 font-serif text-xl text-amber-100" value={session.title} onChange={(event) => update(session.id, { title: event.target.value })} />
                  <Input type="date" className="mt-1 h-8 w-40 border-white/10 bg-black/20 text-xs" value={session.date} onChange={(event) => update(session.id, { date: event.target.value })} />
                </div>
                <Button size="icon" variant="ghost" className="text-stone-600 hover:text-red-300" onClick={() => deleteSession(session)} aria-label={`Delete ${session.title}`}><Trash2 /></Button>
              </div>
              {linkedStories.length > 0 && (
                <section className="mt-4 flex flex-wrap items-center gap-2 border-t border-white/10 pt-4">
                  <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-stone-500"><Link2 size={14} /> Linked stories</span>
                  {linkedStories.map((beat) => (
                    <button key={beat.id} type="button" onClick={() => openStory(beat.id)} className="rounded-full border border-amber-300/20 bg-amber-300/[.06] px-3 py-1 text-xs text-amber-100 transition hover:border-amber-300/40 hover:bg-amber-300/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/60">
                      {beat.title || "Untitled story beat"}
                    </button>
                  ))}
                </section>
              )}
              <div className="mt-4">
                <ScreenshotNotes className="min-h-40" placeholder="Scenes, NPC motivations, clues, treasure, reminders…" value={session.body} onChange={(body) => update(session.id, { body })} screenshots={screenshots} upload={upload} />
              </div>
              <PreparedEncounters session={session} monsters={data.monsters} updateSession={(part) => update(session.id, part)} loadEncounter={loadEncounter} />
            </article>
          );
        })}
      </div>
    </>
  );
}
