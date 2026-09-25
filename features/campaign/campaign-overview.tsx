"use client";

import { useMemo } from "react";
import { Check, ChevronRight, Feather, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScreenTitle } from "@/features/shared/ui";
import { NoteContent, ScreenshotNotes } from "@/features/screenshots/screenshot-notes";
import { useScreenshotLibrary } from "@/features/screenshots/use-screenshot-library";
import type { CampaignPatch, CampaignState } from "./types";

export function CampaignOverview({
  data,
  patch,
  openSession,
  createSession,
}: {
  data: CampaignState;
  patch: CampaignPatch;
  openSession: (id: string) => void;
  createSession: () => void;
}) {
  const { screenshots, upload } = useScreenshotLibrary();
  const sessions = useMemo(
    () =>
      [...data.sessions].sort((a, b) => {
        const dateOrder = (a.date || "9999-12-31").localeCompare(
          b.date || "9999-12-31",
        );
        return dateOrder || a.title.localeCompare(b.title);
      }),
    [data.sessions],
  );
  const formatDate = (date: string) => {
    if (!date) return "Date not set";
    const parsed = new Date(`${date}T00:00:00`);
    return Number.isNaN(parsed.getTime())
      ? date
      : new Intl.DateTimeFormat(undefined, {
          day: "numeric",
          month: "long",
          year: "numeric",
        }).format(parsed);
  };
  return (
    <>
      <ScreenTitle
        eyebrow="Campaign overview"
        title={data.campaignName || "Unnamed campaign"}
      />
      <div className="grid gap-6 xl:grid-cols-[minmax(320px,0.8fr)_minmax(440px,1.2fr)]">
        <section className="space-y-5">
          <article className="rounded-xl border border-white/10 bg-[#12161e] p-5">
            <h2 className="font-serif text-xl text-amber-100">
              Campaign details
            </h2>
            <label className="mt-4 block text-xs text-stone-500">
              Campaign name
              <Input
                className="mt-1 border-white/10 bg-black/20 font-serif text-lg text-amber-100"
                value={data.campaignName}
                onChange={(e) => patch("campaignName", e.target.value)}
                placeholder="Campaign name"
                maxLength={120}
              />
            </label>
            <div className="mt-4 text-xs text-stone-500">
              General campaign notes
              <div className="mt-1">
              <ScreenshotNotes
                className="min-h-72"
                value={data.campaignNotes}
                onChange={(value) => patch("campaignNotes", value)}
                screenshots={screenshots}
                upload={upload}
                placeholder="Campaign premise, locations, factions, house rules, long-term reminders…"
              />
              </div>
            </div>
          </article>
        </section>
        <section>
          <div className="mb-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[.18em] text-amber-300/70">
                  Session history
                </p>
                <h2 className="mt-1 font-serif text-2xl text-stone-100">
                  Timeline
                </h2>
              </div>
              <Button
                type="button"
                size="icon"
                onClick={createSession}
                className="bg-amber-300 text-black hover:bg-amber-200"
                aria-label="Create new session"
                title="Create new session"
              >
                <Plus />
              </Button>
            </div>
            <p className="mt-2 text-sm text-stone-500">
              Generated automatically from the Sessions component. Select an
              entry to open it.
            </p>
          </div>
          {sessions.length ? (
            <div className="relative space-y-4 before:absolute before:bottom-6 before:left-[19px] before:top-6 before:w-px before:bg-white/10">
              {sessions.map((session, index) => (
                <article
                  key={session.id}
                  className="relative grid grid-cols-[40px_1fr] gap-4"
                >
                  <div
                    className={`z-10 mt-5 grid h-10 w-10 place-items-center rounded-full border text-sm font-semibold ${session.done ? "border-emerald-300/40 bg-emerald-300/15 text-emerald-300" : "border-amber-300/30 bg-[#12161e] text-amber-200"}`}
                  >
                    {session.done ? <Check size={18} /> : index + 1}
                  </div>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => openSession(session.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        openSession(session.id);
                      }
                    }}
                    className="rounded-xl border border-white/10 bg-[#12161e] p-5 text-left transition hover:border-amber-300/30 hover:bg-amber-300/[.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/60"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="font-serif text-xl text-amber-100">
                          {session.title || "Untitled session"}
                        </h3>
                        <p className="mt-1 text-xs uppercase tracking-wider text-stone-500">
                          {formatDate(session.date)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          className={
                            session.done
                              ? "border border-emerald-300/20 bg-emerald-300/10 text-emerald-200"
                              : "border border-amber-300/20 bg-amber-300/10 text-amber-100"
                          }
                        >
                          {session.done ? "Completed" : "Planned"}
                        </Badge>
                        <ChevronRight size={17} className="text-stone-500" />
                      </div>
                    </div>
                    {session.body ? (
                      <NoteContent
                        value={session.body}
                        screenshots={screenshots}
                        className="mt-4 text-stone-400"
                      />
                    ) : (
                      <p className="mt-4 text-sm italic text-stone-600">
                        No session notes yet.
                      </p>
                    )}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-white/10 bg-[#12161e]/50 p-10 text-center">
              <Feather className="mx-auto text-stone-600" />
              <h3 className="mt-3 font-serif text-xl text-stone-300">
                No sessions yet
              </h3>
              <p className="mt-2 text-sm text-stone-500">
                Create a session note and it will appear here automatically.
              </p>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
