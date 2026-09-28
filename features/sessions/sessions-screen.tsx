"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Link2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createId } from "@/features/campaign/id";
import type { CampaignPatch, CampaignState, PreparedEncounter, ProgressStatus, SessionNote } from "@/features/campaign/types";
import { richTextToPlainText } from "@/features/rich-text/rich-text";
import { ScreenshotNotes } from "@/features/screenshots/screenshot-notes";
import { useScreenshotLibrary } from "@/features/screenshots/use-screenshot-library";
import { SearchField } from "@/features/shared/search-field";
import { matchesSearch } from "@/features/shared/search";
import { ScreenTitle } from "@/features/shared/ui";
import { removeSessionFromStory } from "@/features/story/domain";
import { createSessionNote, getSessionStatus } from "./domain";
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
  const [search, setSearch] = useState("");
  const [collapsedIds, setCollapsedIds] = useState<string[]>([]);

  function update(id: string, part: Partial<SessionNote>) {
    patch("sessions", data.sessions.map((session) => session.id === id ? { ...session, ...part } : session));
  }
  function addSession() {
    setSearch("");
    patch("sessions", [createSessionNote(createId, new Date().toISOString().slice(0, 10)), ...data.sessions]);
  }
  function deleteSession(session: SessionNote) {
    patch("sessions", data.sessions.filter((item) => item.id !== session.id));
    patch("story", removeSessionFromStory(data.story, session.id));
  }
  function setStatus(session: SessionNote, status: ProgressStatus) {
    update(session.id, { status, done: status === "happened" });
  }
  function toggleCollapsed(id: string) {
    setCollapsedIds((current) => current.includes(id)
      ? current.filter((entry) => entry !== id)
      : [...current, id]);
  }

  const sessions = data.sessions.filter((session) => matchesSearch(search, [
    session.title,
    session.date,
    getSessionStatus(session),
    richTextToPlainText(session.body),
    ...session.encounters.flatMap((encounter) => [
      encounter.name,
      ...encounter.monsters.map((entry) => data.monsters.find((monster) => monster.id === entry.monsterId)?.name),
    ]),
    ...data.story.filter((beat) => beat.sessionIds.includes(session.id)).map((beat) => beat.title),
  ]));

  return (
    <>
      <ScreenTitle eyebrow="Preparation & recap" title="Session notes" action={<Button onClick={addSession} className="bg-amber-300 text-black hover:bg-amber-200"><Plus /> New session</Button>} />
      <SearchField
        id="session-search"
        value={search}
        onChange={setSearch}
        placeholder="Search session titles, dates, notes, encounters, or linked stories…"
        suggestions={data.sessions.map((session) => session.title).filter(Boolean)}
      />
      {!sessions.length ? (
        <p className="rounded-xl border border-dashed border-white/10 bg-[#12161e]/50 p-8 text-center text-sm text-stone-500">
          No sessions match “{search}”.
        </p>
      ) : (
        <div className="space-y-5">
          {sessions.map((session) => {
            const linkedStories = data.story.filter((beat) => beat.sessionIds.includes(session.id));
            const collapsed = collapsedIds.includes(session.id);
            const status = getSessionStatus(session);
            return (
              <article id={`session-${session.id}`} tabIndex={-1} key={session.id} className={`scroll-mt-24 rounded-xl border p-5 outline-none transition focus:ring-2 focus:ring-amber-300/60 ${status === "happened" ? "border-emerald-300/15 bg-emerald-300/[.03]" : status === "active" ? "border-amber-300/20 bg-amber-300/[.03]" : "border-white/10 bg-[#12161e]"}`}>
                <div className="flex flex-wrap items-start gap-3">
                  <div className="min-w-0 flex-1">
                    {collapsed ? (
                      <>
                        <h2 className="truncate font-serif text-xl text-amber-100">{session.title || "Untitled session"}</h2>
                        <p className="mt-1 text-xs uppercase tracking-wider text-stone-500">{session.date || "Date not set"}</p>
                      </>
                    ) : (
                      <>
                        <Input className="border-0 bg-transparent px-0 font-serif text-xl text-amber-100" value={session.title} onChange={(event) => update(session.id, { title: event.target.value })} />
                        <Input type="date" className="mt-1 h-8 w-40 border-white/10 bg-black/20 text-xs" value={session.date} onChange={(event) => update(session.id, { date: event.target.value })} />
                      </>
                    )}
                  </div>
                  <select className="rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm" value={status} onChange={(event) => setStatus(session, event.target.value as ProgressStatus)} aria-label={`Status for ${session.title}`}>
                    <option value="planned">Planned</option>
                    <option value="active">Active now</option>
                    <option value="happened">Happened</option>
                  </select>
                  <Button size="icon" variant="ghost" onClick={() => toggleCollapsed(session.id)} aria-label={`${collapsed ? "Expand" : "Collapse"} ${session.title}`}>
                    {collapsed ? <ChevronRight /> : <ChevronDown />}
                  </Button>
                  <Button size="icon" variant="ghost" className="text-stone-600 hover:text-red-300" onClick={() => deleteSession(session)} aria-label={`Delete ${session.title}`}><Trash2 /></Button>
                </div>
                {!collapsed && (
                  <>
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
                  </>
                )}
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
