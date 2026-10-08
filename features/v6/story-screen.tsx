"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  ChevronsUpDown,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { SaveStatus } from "@/features/shared/save-status";
import { useUnsavedChanges } from "@/features/shared/unsaved-changes";
import { reconcileSaved } from "@/features/encounters/drafts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  RichTextContent,
  RichTextEditor,
  richTextToPlainText,
} from "@/features/rich-text/rich-text";
import {
  createV6StoryBeat,
  deleteV6StoryBeat,
  listV6Sessions,
  listV6Story,
  updateV6StoryBeat,
  uploadV6Screenshot,
} from "./api-client";
import { StatusBadge, StatusSelect } from "./progress-status";
import { Empty, Section } from "./sessions-screen";
import type { V6Session, V6StoryBeat } from "./types";

export function StoryScreen({
  campaignId,
  editable,
  initialOpenId,
  onOpenSession,
}: {
  campaignId: string;
  editable: boolean;
  initialOpenId?: string;
  onOpenSession: (id: string) => void;
}) {
  const [story, setStory] = useState<V6StoryBeat[]>([]);
  const [persisted, setPersisted] = useState<V6StoryBeat[]>([]);
  const [savingId, setSavingId] = useState<string | null>(null);
  const dirtyIds = new Set(
    story
      .filter(
        (item) =>
          JSON.stringify(item) !==
          JSON.stringify(persisted.find(({ id }) => id === item.id)),
      )
      .map(({ id }) => id),
  );
  useUnsavedChanges(dirtyIds.size > 0);
  const [sessions, setSessions] = useState<V6Session[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(initialOpenId ? [initialOpenId] : []),
  );
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let live = true;
    void Promise.all([listV6Story(campaignId), listV6Sessions(campaignId)])
      .then(([beats, linkedSessions]) => {
        if (live) {
          setStory(beats);
          setPersisted(beats);
          setSessions(linkedSessions);
        }
      })
      .catch(report);
    return () => {
      live = false;
    };
  }, [campaignId]);
  function report(error: unknown) {
    toast.error(
      error instanceof Error ? error.message : "Story update failed.",
    );
  }
  const visible = useMemo(() => {
    const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
    return story.filter((item) =>
      terms.every((term) =>
        `${item.title} ${item.chapter} ${richTextToPlainText(item.details)}`
          .toLowerCase()
          .includes(term),
      ),
    );
  }, [query, story]);
  function patch(id: string, values: Partial<V6StoryBeat>) {
    setStory((all) =>
      all.map((item) => (item.id === id ? { ...item, ...values } : item)),
    );
  }
  async function add() {
    setBusy(true);
    try {
      const beat = await createV6StoryBeat(campaignId, {
        title: "New story beat",
        chapter: "",
        details: "",
        status: "planned",
        sortOrder: story.length,
        sessionIds: [],
      });
      setStory((all) => [...all, beat]);
      setPersisted((all) => [...all, beat]);
      setExpanded(new Set([beat.id]));
    } catch (error) {
      report(error);
    } finally {
      setBusy(false);
    }
  }
  async function save(item: V6StoryBeat) {
    setSavingId(item.id);
    setBusy(true);
    try {
      const saved = await updateV6StoryBeat(campaignId, item);
      setStory((all) =>
        all.map((entry) =>
          entry.id === saved.id ? reconcileSaved(entry, item, saved) : entry,
        ),
      );
      setPersisted((all) =>
        all.map((entry) => (entry.id === saved.id ? saved : entry)),
      );
      toast.success("Story beat saved");
    } catch (error) {
      report(error);
    } finally {
      setSavingId(null);
      setBusy(false);
    }
  }
  async function remove(item: V6StoryBeat) {
    if (!window.confirm(`Delete ${item.title}?`)) return;
    setBusy(true);
    try {
      await deleteV6StoryBeat(campaignId, item.id);
      setStory((all) => all.filter(({ id }) => id !== item.id));
    } catch (error) {
      report(error);
    } finally {
      setBusy(false);
    }
  }
  function toggle(id: string) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  const allOpen =
    visible.length > 0 && visible.every(({ id }) => expanded.has(id));

  return (
    <Section
      title="Story"
      description="Shape story beats and connect them to one or more sessions."
      query={query}
      setQuery={setQuery}
      actions={
        <>
          <Button
            variant="outline"
            onClick={() =>
              setExpanded(
                allOpen ? new Set() : new Set(visible.map(({ id }) => id)),
              )
            }
          >
            <ChevronsUpDown /> {allOpen ? "Collapse all" : "Expand all"}
          </Button>
          {editable && (
            <Button
              onClick={add}
              disabled={busy}
              className="bg-amber-300 text-black hover:bg-amber-200"
            >
              <Plus /> Story beat
            </Button>
          )}
        </>
      }
    >
      {visible.map((beat) => {
        const open = expanded.has(beat.id);
        const linked = sessions.filter(({ id }) =>
          beat.sessionIds.includes(id),
        );
        const available = sessions.filter(
          ({ id }) => !beat.sessionIds.includes(id),
        );
        return (
          <article
            key={beat.id}
            className="rounded-xl border border-white/10 bg-[#13161d]"
          >
            <button
              type="button"
              className="flex w-full items-center gap-3 p-4 text-left"
              onClick={() => toggle(beat.id)}
            >
              {open ? (
                <ChevronDown className="size-4" />
              ) : (
                <ChevronRight className="size-4" />
              )}
              <span className="min-w-0 flex-1 truncate font-medium">
                {beat.title || "Untitled story beat"}
              </span>
              {beat.chapter && (
                <span className="hidden text-xs text-stone-500 sm:block">
                  {beat.chapter}
                </span>
              )}
              <SaveStatus
                dirty={dirtyIds.has(beat.id)}
                saving={savingId === beat.id}
                label={`Story ${beat.title}`}
              />
              <StatusBadge status={beat.status} />
            </button>
            {open && (
              <div className="border-t border-white/10 p-4 sm:p-5">
                <div className="grid gap-3 sm:grid-cols-[1fr_12rem_10rem]">
                  <Input
                    value={beat.title}
                    disabled={!editable}
                    onChange={(event) =>
                      patch(beat.id, { title: event.target.value })
                    }
                  />
                  <Input
                    placeholder="Chapter"
                    value={beat.chapter}
                    disabled={!editable}
                    onChange={(event) =>
                      patch(beat.id, { chapter: event.target.value })
                    }
                  />
                  <StatusSelect
                    value={beat.status}
                    disabled={!editable}
                    onChange={(status) => patch(beat.id, { status })}
                  />
                </div>
                <div className="mt-4">
                  {editable ? (
                    <RichTextEditor
                      value={beat.details}
                      onChange={(details) => patch(beat.id, { details })}
                      onPasteImage={uploadV6Screenshot}
                      placeholder="Story details…"
                      className="min-h-48"
                    />
                  ) : (
                    <RichTextContent value={beat.details} />
                  )}
                </div>
                <div className="mt-4 rounded-lg border border-white/10 bg-black/20 p-3">
                  <p className="text-xs font-medium uppercase tracking-wider text-stone-500">
                    Linked sessions
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {linked.map((session) => (
                      <span
                        key={session.id}
                        className="inline-flex items-center rounded-full bg-violet-400/10 text-xs text-violet-300"
                      >
                        <button
                          className="px-3 py-1.5 hover:text-violet-100"
                          onClick={() => onOpenSession(session.id)}
                        >
                          {session.title} · {session.status}
                        </button>
                        {editable && (
                          <button
                            className="pr-2"
                            aria-label={`Unlink ${session.title}`}
                            onClick={() =>
                              patch(beat.id, {
                                sessionIds: beat.sessionIds.filter(
                                  (id) => id !== session.id,
                                ),
                              })
                            }
                          >
                            <X className="size-3" />
                          </button>
                        )}
                      </span>
                    ))}
                  </div>
                  {editable && (
                    <select
                      aria-label="Link a session"
                      className="mt-3 h-9 w-full rounded-md border border-white/10 bg-[#191d27] px-3 text-sm"
                      value=""
                      onChange={(event) => {
                        if (event.target.value)
                          patch(beat.id, {
                            sessionIds: [
                              ...beat.sessionIds,
                              event.target.value,
                            ],
                          });
                      }}
                    >
                      <option value="">Select a session to link…</option>
                      {available.map((session) => (
                        <option key={session.id} value={session.id}>
                          {session.title} · {session.status}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                {editable && (
                  <div className="sticky bottom-0 z-10 mt-4 flex items-center justify-end gap-2 border-t border-white/10 bg-[#13161d]/95 py-3 backdrop-blur">
                    <Button
                      variant="ghost"
                      onClick={() => remove(beat)}
                      disabled={busy}
                    >
                      <Trash2 /> Delete
                    </Button>
                    <SaveStatus
                      dirty={dirtyIds.has(beat.id)}
                      saving={savingId === beat.id}
                      label={`Story ${beat.title}`}
                    />
                    <Button onClick={() => save(beat)} disabled={busy}>
                      <Save /> Save
                    </Button>
                  </div>
                )}
              </div>
            )}
          </article>
        );
      })}
      {!visible.length && <Empty>No story beats match this search.</Empty>}
    </Section>
  );
}
