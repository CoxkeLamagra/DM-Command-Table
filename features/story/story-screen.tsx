"use client";

import { useState } from "react";
import { Check, ChevronDown, ChevronRight, Link2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createId } from "@/features/campaign/id";
import type { CampaignPatch, CampaignState, StoryBeat } from "@/features/campaign/types";
import { richTextToPlainText } from "@/features/rich-text/rich-text";
import { ScreenshotNotes } from "@/features/screenshots/screenshot-notes";
import { useScreenshotLibrary } from "@/features/screenshots/use-screenshot-library";
import { SearchField } from "@/features/shared/search-field";
import { matchesSearch } from "@/features/shared/search";
import { ScreenTitle } from "@/features/shared/ui";
import { getSessionStatus, sessionStatusLabel } from "@/features/sessions/domain";
import { toggleStorySession } from "./domain";

export function Story({ data, patch }: { data: CampaignState; patch: CampaignPatch }) {
  const { screenshots, upload } = useScreenshotLibrary();
  const [search, setSearch] = useState("");
  const [collapsedIds, setCollapsedIds] = useState<string[]>([]);
  const update = (id: string, part: Partial<StoryBeat>) =>
    patch("story", data.story.map((beat) => beat.id === id ? { ...beat, ...part } : beat));

  function deleteBeat(beat: StoryBeat) {
    if (!window.confirm(`Delete the story beat "${beat.title}"?`)) return;
    patch("story", data.story.filter((entry) => entry.id !== beat.id));
  }
  function toggleSession(beat: StoryBeat, sessionId: string) {
    const toggled = toggleStorySession(beat, sessionId);
    update(beat.id, { sessionIds: toggled.sessionIds });
  }
  function toggleCollapsed(id: string) {
    setCollapsedIds((current) => current.includes(id)
      ? current.filter((entry) => entry !== id)
      : [...current, id]);
  }

  const story = data.story.filter((beat) => matchesSearch(search, [
    beat.title,
    beat.chapter,
    beat.status,
    richTextToPlainText(beat.details),
    ...data.sessions
      .filter((session) => beat.sessionIds.includes(session.id))
      .flatMap((session) => [session.title, session.date]),
  ]));

  return (
    <>
      <ScreenTitle
        eyebrow="Campaign arc"
        title="Storyline"
        action={
          <Button
            onClick={() => patch("story", [...data.story, {
              id: createId(), title: "New story beat", chapter: "Unsorted",
              details: "", status: "planned", sessionIds: [],
            }])}
            className="bg-amber-300 text-black hover:bg-amber-200"
          >
            <Plus /> Add story beat
          </Button>
        }
      />
      <SearchField
        id="story-search"
        value={search}
        onChange={setSearch}
        placeholder="Search story titles, chapters, notes, or linked sessions…"
        suggestions={data.story.map((beat) => beat.title).filter(Boolean)}
      />
      {!story.length ? (
        <p className="rounded-xl border border-dashed border-white/10 bg-[#12161e]/50 p-8 text-center text-sm text-stone-500">
          No story beats match “{search}”.
        </p>
      ) : (
        <div className="relative space-y-4 before:absolute before:bottom-6 before:left-[19px] before:top-6 before:w-px before:bg-white/10">
          {story.map((beat) => {
            const collapsed = collapsedIds.includes(beat.id);
            const sequence = data.story.findIndex((entry) => entry.id === beat.id) + 1;
            return (
              <article id={`story-${beat.id}`} tabIndex={-1} key={beat.id} className="relative grid scroll-mt-24 grid-cols-[40px_1fr] gap-4 rounded-xl outline-none focus:ring-2 focus:ring-amber-300/60">
                <div className={`z-10 mt-5 grid h-10 w-10 place-items-center rounded-full border ${beat.status === "happened" ? "border-emerald-300/40 bg-emerald-300/15 text-emerald-300" : beat.status === "active" ? "border-amber-300/50 bg-amber-300/15 text-amber-200" : "border-white/15 bg-[#12161e] text-stone-600"}`}>
                  {beat.status === "happened" ? <Check size={18} /> : sequence}
                </div>
                <div className="rounded-xl border border-white/10 bg-[#12161e] p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <Button size="icon" variant="ghost" className="shrink-0" onClick={() => toggleCollapsed(beat.id)} aria-label={`${collapsed ? "Expand" : "Collapse"} ${beat.title}`}>
                      {collapsed ? <ChevronRight /> : <ChevronDown />}
                    </Button>
                    <div className="min-w-0 flex-1">
                      {collapsed ? (
                        <>
                          <h2 className="truncate font-serif text-xl text-amber-100">{beat.title || "Untitled story beat"}</h2>
                          <p className="mt-1 text-xs uppercase tracking-wider text-stone-500">{beat.chapter || "Unsorted"}</p>
                        </>
                      ) : (
                        <>
                          <Input className="h-auto border-0 bg-transparent p-0 font-serif text-xl text-amber-100" value={beat.title} onChange={(event) => update(beat.id, { title: event.target.value })} />
                          <Input className="mt-1 h-auto border-0 bg-transparent p-0 text-xs uppercase tracking-wider text-stone-500" value={beat.chapter} onChange={(event) => update(beat.id, { chapter: event.target.value })} />
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <select className="rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm" value={beat.status} onChange={(event) => update(beat.id, { status: event.target.value as StoryBeat["status"] })} aria-label={`Status for ${beat.title}`}>
                        <option value="planned">Planned</option>
                        <option value="active">Active now</option>
                        <option value="happened">Happened</option>
                      </select>
                      <Button size="icon" variant="ghost" className="text-stone-600 hover:text-red-300" onClick={() => deleteBeat(beat)} aria-label={`Delete ${beat.title}`}><Trash2 /></Button>
                    </div>
                  </div>
                  {!collapsed && (
                    <>
                      <div className="mt-4">
                        <ScreenshotNotes className="min-h-24" value={beat.details} onChange={(details) => update(beat.id, { details })} screenshots={screenshots} upload={upload} />
                      </div>
                      <section className="mt-4 border-t border-white/10 pt-4">
                        <h3 className="flex items-center gap-2 text-sm font-medium text-stone-300"><Link2 size={15} className="text-amber-300/70" /> Linked sessions</h3>
                        {data.sessions.length ? (
                          <div className="mt-3 grid gap-2 sm:grid-cols-2">
                            {data.sessions.map((session) => {
                              const status = getSessionStatus(session);
                              return (
                                <label key={session.id} className={`flex cursor-pointer items-start gap-2 rounded-md border px-3 py-2 text-sm transition ${beat.sessionIds.includes(session.id) ? "border-amber-300/30 bg-amber-300/[.06] text-amber-100" : "border-white/10 bg-black/20 text-stone-400 hover:border-white/20"}`}>
                                  <input type="checkbox" className="mt-0.5 size-4 accent-amber-300" checked={beat.sessionIds.includes(session.id)} onChange={() => toggleSession(beat, session.id)} />
                                  <span className="min-w-0 flex-1">
                                    <span className="block truncate">{session.title || "Untitled session"}</span>
                                    <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-stone-600">
                                      <span>{session.date || "Date not set"}</span>
                                      <span className="rounded-full border border-white/10 px-2 py-0.5 text-stone-400">{sessionStatusLabel(status)}</span>
                                    </span>
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="mt-2 text-sm italic text-stone-600">Create a session before linking it to this story beat.</p>
                        )}
                      </section>
                    </>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
