"use client";

import { Link2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SessionNote, StoryBeat } from "@/features/campaign/types";
import { getSessionStatus, sessionStatusLabel } from "@/features/sessions/domain";

export function LinkedSessions({
  beat,
  sessions,
  link,
  unlink,
  openSession,
}: {
  beat: StoryBeat;
  sessions: SessionNote[];
  link: (sessionId: string) => void;
  unlink: (sessionId: string) => void;
  openSession: (sessionId: string) => void;
}) {
  const linked = sessions.filter((session) => beat.sessionIds.includes(session.id));
  const available = sessions.filter((session) => !beat.sessionIds.includes(session.id));

  return (
    <section className="mt-4 border-t border-white/10 pt-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-sm font-medium text-stone-300">
          <Link2 size={15} className="text-amber-300/70" /> Linked sessions
        </h3>
        <select
          className="min-w-52 rounded-md border border-amber-300/20 bg-[#080a0f] px-3 py-2 text-sm text-amber-100 [color-scheme:dark] [&>option]:bg-[#080a0f] [&>option]:text-stone-100"
          value=""
          onChange={(event) => event.target.value && link(event.target.value)}
          disabled={!available.length}
          aria-label={`Link a session to ${beat.title}`}
        >
          <option value="">
            {available.length ? "Link a session…" : sessions.length ? "All sessions linked" : "No sessions available"}
          </option>
          {available.map((session) => (
            <option key={session.id} value={session.id}>
              {session.title || "Untitled session"}{session.date ? ` — ${session.date}` : ""}
            </option>
          ))}
        </select>
      </div>
      {linked.length ? (
        <div className="mt-3 space-y-2">
          {linked.map((session) => {
            const status = getSessionStatus(session);
            return (
              <div key={session.id} className="flex flex-wrap items-center gap-3 rounded-md border border-amber-300/20 bg-amber-300/[.05] px-3 py-2">
                <button type="button" onClick={() => openSession(session.id)} className="min-w-0 flex-1 text-left text-sm font-medium text-amber-100 hover:text-amber-200 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/60">
                  <span className="block truncate">{session.title || "Untitled session"}</span>
                </button>
                <span className="text-xs text-stone-500">{session.date || "Date not set"}</span>
                <span className="rounded-full border border-white/10 px-2 py-0.5 text-xs text-stone-400">{sessionStatusLabel(status)}</span>
                <Button type="button" size="icon-sm" variant="ghost" className="text-stone-500 hover:text-red-300" onClick={() => unlink(session.id)} aria-label={`Unlink ${session.title || "session"}`} title="Unlink session">
                  <X />
                </Button>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="mt-3 text-sm italic text-stone-600">
          {sessions.length ? "No sessions linked yet. Select one from the list above." : "Create a session before linking it to this story beat."}
        </p>
      )}
    </section>
  );
}
