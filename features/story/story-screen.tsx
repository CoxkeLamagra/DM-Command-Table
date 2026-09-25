"use client";

import { Check, Link2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScreenTitle } from "@/features/shared/ui";
import { ScreenshotNotes } from "@/features/screenshots/screenshot-notes";
import { useScreenshotLibrary } from "@/features/screenshots/use-screenshot-library";
import { createId } from "@/features/campaign/id";
import type {
  CampaignPatch,
  CampaignState,
  StoryBeat,
} from "@/features/campaign/types";

const uid = createId;

export function Story({
  data,
  patch,
}: {
  data: CampaignState;
  patch: CampaignPatch;
}) {
  const { screenshots, upload } = useScreenshotLibrary();
  const update = (id: string, p: Partial<StoryBeat>) =>
    patch(
      "story",
      data.story.map((s) => (s.id === id ? { ...s, ...p } : s)),
    );
  function deleteBeat(beat: StoryBeat) {
    if (!window.confirm(`Delete the story beat "${beat.title}"?`)) return;
    patch(
      "story",
      data.story.filter((entry) => entry.id !== beat.id),
    );
  }
  function toggleSession(beat: StoryBeat, sessionId: string) {
    update(beat.id, {
      sessionIds: beat.sessionIds.includes(sessionId)
        ? beat.sessionIds.filter((id) => id !== sessionId)
        : [...beat.sessionIds, sessionId],
    });
  }
  return (
    <>
      <ScreenTitle
        eyebrow="Campaign arc"
        title="Storyline"
        action={
          <Button
            onClick={() =>
              patch("story", [
                ...data.story,
                {
                  id: uid(),
                  title: "New story beat",
                  chapter: "Unsorted",
                  details: "",
                  status: "planned",
                  sessionIds: [],
                },
              ])
            }
            className="bg-amber-300 text-black hover:bg-amber-200"
          >
            <Plus /> Add story beat
          </Button>
        }
      />
      <div className="relative space-y-4 before:absolute before:bottom-6 before:left-[19px] before:top-6 before:w-px before:bg-white/10">
        {data.story.map((s, i) => (
          <article
            id={`story-${s.id}`}
            tabIndex={-1}
            key={s.id}
            className="relative grid scroll-mt-24 grid-cols-[40px_1fr] gap-4 rounded-xl outline-none focus:ring-2 focus:ring-amber-300/60"
          >
            <div
              className={`z-10 mt-5 grid h-10 w-10 place-items-center rounded-full border ${s.status === "happened" ? "border-emerald-300/40 bg-emerald-300/15 text-emerald-300" : s.status === "active" ? "border-amber-300/50 bg-amber-300/15 text-amber-200" : "border-white/15 bg-[#12161e] text-stone-600"}`}
            >
              {s.status === "happened" ? <Check size={18} /> : i + 1}
            </div>
            <div className="rounded-xl border border-white/10 bg-[#12161e] p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <Input
                    className="h-auto border-0 bg-transparent p-0 font-serif text-xl text-amber-100"
                    value={s.title}
                    onChange={(e) => update(s.id, { title: e.target.value })}
                  />
                  <Input
                    className="mt-1 h-auto border-0 bg-transparent p-0 text-xs uppercase tracking-wider text-stone-500"
                    value={s.chapter}
                    onChange={(e) => update(s.id, { chapter: e.target.value })}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <select
                    className="rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm"
                    value={s.status}
                    onChange={(e) =>
                      update(s.id, {
                        status: e.target.value as StoryBeat["status"],
                      })
                    }
                  >
                    <option value="planned">Planned</option>
                    <option value="active">Active now</option>
                    <option value="happened">Happened</option>
                  </select>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-stone-600 hover:text-red-300"
                    onClick={() => deleteBeat(s)}
                    aria-label={`Delete ${s.title}`}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </div>
              <div className="mt-4">
              <ScreenshotNotes
                className="min-h-24"
                value={s.details}
                onChange={(details) => update(s.id, { details })}
                screenshots={screenshots}
                upload={upload}
              />
              </div>
              <section className="mt-4 border-t border-white/10 pt-4">
                <h3 className="flex items-center gap-2 text-sm font-medium text-stone-300">
                  <Link2 size={15} className="text-amber-300/70" /> Linked sessions
                </h3>
                {data.sessions.length ? (
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {data.sessions.map((session) => (
                      <label
                        key={session.id}
                        className={`flex cursor-pointer items-start gap-2 rounded-md border px-3 py-2 text-sm transition ${s.sessionIds.includes(session.id) ? "border-amber-300/30 bg-amber-300/[.06] text-amber-100" : "border-white/10 bg-black/20 text-stone-400 hover:border-white/20"}`}
                      >
                        <input
                          type="checkbox"
                          className="mt-0.5 size-4 accent-amber-300"
                          checked={s.sessionIds.includes(session.id)}
                          onChange={() => toggleSession(s, session.id)}
                        />
                        <span>
                          <span className="block">{session.title || "Untitled session"}</span>
                          <span className="block text-xs text-stone-600">
                            {session.date || "Date not set"}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-sm italic text-stone-600">
                    Create a session before linking it to this story beat.
                  </p>
                )}
              </section>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
