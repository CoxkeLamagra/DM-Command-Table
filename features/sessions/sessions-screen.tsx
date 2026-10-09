"use client";

import { SessionContinuityEditor } from "../adventure/session-continuity";
import { PrintPacketButton } from "../adventure/print-packet";
import { CarryDialog } from "../adventure/carry-dialog";
import { emptyContinuity } from "@/domain/adventure";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  ChevronsUpDown,
  FilePlus,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import { useRecordFocus } from "@/features/shared/use-record-focus";
import { SaveStatus } from "@/features/shared/save-status";
import { reconcileSaved } from "@/features/encounters/drafts";
import { useDraftRecovery, DraftAccount } from "../shared/draft-recovery";
import { draftKey, readDraft } from "../shared/draft-storage";
import { useContext } from "react";
import { useUnsavedChanges } from "@/features/shared/unsaved-changes";
import { toast } from "sonner";
import { Tabs } from "radix-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  RichTextContent,
  RichTextEditor,
  richTextToPlainText,
} from "@/features/rich-text/rich-text";
import {
  getCampaign,
  listPlayers,
  createSession,
  deleteSession,
  deleteSessionTemplate,
  listSessions,
  listSessionTemplates,
  listStory,
  saveSessionTemplate,
  saveSessionPreparation,
  type EncounterDraftController,
  uploadScreenshot,
} from "../shared/api-client";
import { nextSession } from "../shared/next-session";
import { SessionRoster } from "./session-roster";
import { PreparedEncounters } from "../encounters/prepared-encounters";
import { StatusBadge, StatusSelect } from "../shared/progress-status";
import type {
  Campaign,
  Player,
  Session,
  SessionTemplate,
  StoryBeat,
} from "@/domain/types";

import {
  Section,
  Empty,
  sessionTabClass,
} from "@/features/shared/record-section";
export function SessionsScreen({
  campaignId,
  editable,
  initialOpenId,
  onOpenStory,
  onOpenCombat,
}: {
  campaignId: string;
  editable: boolean;
  initialOpenId?: string;
  onOpenStory: (id: string) => void;
  onOpenCombat: () => void;
}) {
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [carry, setCarry] = useState<Session | null>(null);
  useEffect(() => {
    let live = true;
    void Promise.all([getCampaign(campaignId), listPlayers(campaignId)])
      .then(([value, roster]) => {
        if (live) {
          setCampaign(value);
          setPlayers(roster);
        }
      })
      .catch((error) => toast.error(error.message));
    return () => {
      live = false;
    };
  }, [campaignId]);
  const [playId, setPlayId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [story, setStory] = useState<StoryBeat[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(initialOpenId ? [initialOpenId] : []),
  );
  const [visited, setVisited] = useState<Set<string>>(
    () => new Set(initialOpenId ? [initialOpenId] : []),
  );
  const [dirty, setDirty] = useState<Set<string>>(() => new Set());
  const [encounterDirty, setEncounterDirty] = useState<Set<string>>(
    () => new Set(),
  );
  const [encounterCounts, setEncounterCounts] = useState<
    Record<string, number>
  >({});
  const updateEncounterCount = useCallback((id: string, count: number) => {
    setEncounterCounts((current) =>
      current[id] === count ? current : { ...current, [id]: count },
    );
  }, []);
  const [savingSession, setSavingSession] = useState<string | null>(null);
  const markEncounterDirty = useCallback((id: string, value: boolean) => {
    setEncounterDirty((current) => {
      if (current.has(id) === value) return current;
      const next = new Set(current);
      if (value) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);
  useUnsavedChanges(dirty.size > 0 || encounterDirty.size > 0);
  const sessionsRef = useRef(sessions);
  useEffect(() => {
    sessionsRef.current = sessions;
  }, [sessions]);
  const [loaded, setLoaded] = useState(false);
  const userId = useContext(DraftAccount);
  const recovery = useDraftRecovery({
    campaignId,
    scope: "sessions",
    value: sessions.filter(({ id }) => dirty.has(id)),
    dirty: dirty.size > 0,
    ready: loaded && editable,
    restore: (values) => {
      if (
        !Array.isArray(values) ||
        values.some(
          (value) =>
            typeof value?.id !== "string" || typeof value.notes !== "string",
        )
      )
        throw new Error("Invalid draft");
      if (values.some((value) => !sessions.some(({ id }) => id === value.id)))
        throw new Error(
          "A session was removed. Download this draft to recover its text.",
        );
      setSessions((all) =>
        all.map((item) => values.find(({ id }) => id === item.id) ?? item),
      );
      const ids = values.map(({ id }) => id);
      setDirty(new Set(ids));
      setExpanded(new Set(ids));
      setVisited((all) => new Set([...all, ...ids]));
    },
  });
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [templates, setTemplates] = useState<SessionTemplate[]>([]);
  const encounterSavers = useRef(new Map<string, EncounterDraftController>());

  useEffect(() => {
    let live = true;
    void Promise.all([listSessions(campaignId), listStory(campaignId)])
      .then(([nextSessions, nextStory]) => {
        if (live) {
          setSessions(nextSessions);
          setLoaded(true);
          try {
            const recoverable = userId
              ? nextSessions
                  .filter(({ id }) =>
                    readDraft(
                      localStorage,
                      draftKey(userId, campaignId, `prepared:${id}`),
                    ),
                  )
                  .map(({ id }) => id)
              : [];
            if (recoverable.length) {
              setExpanded(new Set(recoverable));
              setVisited((all) => new Set([...all, ...recoverable]));
            }
          } catch {}
          setStory(nextStory);
        }
      })
      .catch(report);
    return () => {
      live = false;
    };
  }, [campaignId, userId]);
  useRecordFocus(
    initialOpenId ? `session-${initialOpenId}` : undefined,
    sessions.some(({ id }) => id === initialOpenId),
  );
  function report(error: unknown) {
    toast.error(
      error instanceof Error ? error.message : "Session update failed.",
    );
  }
  const visible = useMemo(() => {
    const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
    return sessions.filter((item) =>
      terms.every((term) =>
        `${item.title} ${item.date} ${richTextToPlainText(item.notes)} ${richTextToPlainText(item.continuity?.recap ?? "")} ${richTextToPlainText(item.continuity?.rewards ?? "")} ${(item.continuity?.scenes ?? []).map((scene) => scene.title + " " + richTextToPlainText(scene.notes)).join(" ")}`
          .toLowerCase()
          .includes(term),
      ),
    );
  }, [query, sessions]);
  function patch(id: string, values: Partial<Session>) {
    setDirty((current) => new Set(current).add(id));
    setSessions((all) =>
      all.map((item) => (item.id === id ? { ...item, ...values } : item)),
    );
  }
  async function add() {
    setBusy(true);
    try {
      const item = await createSession(campaignId, {
        title: "New session",
        date: new Date().toISOString().slice(0, 10),
        notes: "",
        status: "planned",
        sortOrder: sessions.length,
      });
      setSessions((all) => [item, ...all]);
      setExpanded(new Set([item.id]));
      setVisited((current) => new Set(current).add(item.id));
    } catch (error) {
      report(error);
    } finally {
      setBusy(false);
    }
  }
  const registerEncounterSaver = useCallback(
    (sessionId: string, saver: EncounterDraftController) => {
      encounterSavers.current.set(sessionId, saver);
      return () => {
        if (encounterSavers.current.get(sessionId) === saver)
          encounterSavers.current.delete(sessionId);
      };
    },
    [],
  );
  async function save(item: Session) {
    setSavingSession(item.id);
    setBusy(true);
    try {
      const controller = encounterSavers.current.get(item.id);
      const submitted = controller?.snapshot() ?? [];
      const result = await saveSessionPreparation(campaignId, item, submitted);
      controller?.reconcile(submitted, result.encounters);
      const current = sessionsRef.current.find(({ id }) => id === item.id);
      setSessions((all) =>
        all.map((entry) =>
          entry.id === item.id
            ? reconcileSaved(entry, item, result.session)
            : entry,
        ),
      );
      if (current === item)
        setDirty((ids) => {
          const next = new Set(ids);
          next.delete(item.id);
          return next;
        });
      toast.success("Session and prepared encounters saved");
    } catch (error) {
      report(error);
    } finally {
      setSavingSession(null);
      setBusy(false);
    }
  }
  async function remove(item: Session) {
    if (!window.confirm(`Delete ${item.title}?`)) return;
    setBusy(true);
    try {
      await deleteSession(campaignId, item.id);
      markEncounterDirty(item.id, false);
      setSessions((all) => all.filter(({ id }) => id !== item.id));
      if (playId === item.id) setPlayId(null);
      setDirty((ids) => {
        const next = new Set(ids);
        next.delete(item.id);
        return next;
      });
      setStory((all) =>
        all.map((beat) => ({
          ...beat,
          sessionIds: beat.sessionIds.filter((id) => id !== item.id),
        })),
      );
    } catch (error) {
      report(error);
    } finally {
      setBusy(false);
    }
  }
  function toggle(id: string) {
    setVisited((current) => new Set(current).add(id));
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  const allOpen =
    visible.length > 0 && visible.every(({ id }) => expanded.has(id));
  async function openTemplates() {
    setTemplatesOpen(true);
    try {
      setTemplates(await listSessionTemplates());
    } catch (error) {
      report(error);
    }
  }
  async function applyTemplate(template: SessionTemplate) {
    try {
      const value = JSON.parse(template.content) as Partial<Session>;
      const item = await createSession(campaignId, {
        title: value.title || template.name,
        date: new Date().toISOString().slice(0, 10),
        notes: value.notes ?? "",
        status: "planned",
        sortOrder: sessions.length,
        continuity: {
          ...emptyContinuity(),
          scenes: (value.continuity?.scenes ?? []).map((scene) => ({
            ...scene,
            id: crypto.randomUUID(),
            done: false,
          })),
        },
      });
      setSessions((all) => [item, ...all]);
      setExpanded(new Set([item.id]));
      setVisited((current) => new Set(current).add(item.id));
      setTemplatesOpen(false);
    } catch (error) {
      report(error);
    }
  }
  async function saveTemplate(item: Session) {
    const name = window.prompt("Template name:", item.title)?.trim();
    if (!name) return;
    try {
      const template = await saveSessionTemplate(
        name,
        JSON.stringify({
          title: item.title,
          notes: item.notes,
          continuity: {
            ...emptyContinuity(),
            scenes: (item.continuity?.scenes ?? []).map((scene) => ({
              ...scene,
              done: false,
            })),
          },
        }),
      );
      setTemplates((all) => [template, ...all]);
      toast.success("Session template saved");
    } catch (error) {
      report(error);
    }
  }

  return (
    <>
      {recovery.banner}
      <Section
        title={playId ? "Session play view" : "Sessions"}
        description={
          playId
            ? "Notes, encounters, story context and NPC references for the session you are running."
            : "Plan sessions, record outcomes, and prepare encounters."
        }
        query={query}
        setQuery={setQuery}
        actions={
          <>
            {playId ? (
              <>
                <select
                  aria-label="Playing session"
                  className="h-9 max-w-64 rounded-md border border-white/10 bg-[#151820] px-3 text-sm"
                  value={playId}
                  onChange={(event) => {
                    const id = event.target.value;
                    setPlayId(id);
                    setExpanded((all) => new Set(all).add(id));
                    setVisited((all) => new Set(all).add(id));
                  }}
                >
                  {sessions.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.title}
                    </option>
                  ))}
                </select>
                <Button variant="outline" onClick={() => setPlayId(null)}>
                  Back to preparation
                </Button>
              </>
            ) : (
              <Button
                variant="outline"
                disabled={!sessions.length}
                onClick={() => {
                  const id = (
                    sessions.find(({ id }) => id === initialOpenId) ??
                    nextSession(sessions) ??
                    sessions[0]
                  )?.id;
                  if (id) {
                    setPlayId(id);
                    setExpanded((all) => new Set(all).add(id));
                    setVisited((all) => new Set(all).add(id));
                    setQuery("");
                  }
                }}
              >
                Session play view
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => {
                setVisited(
                  (current) =>
                    new Set([...current, ...visible.map(({ id }) => id)]),
                );
                setExpanded(
                  allOpen ? new Set() : new Set(visible.map(({ id }) => id)),
                );
              }}
            >
              <ChevronsUpDown /> {allOpen ? "Collapse all" : "Expand all"}
            </Button>
            {editable && (
              <Button variant="outline" onClick={openTemplates}>
                <FilePlus /> Templates
              </Button>
            )}
            {editable && (
              <Button
                onClick={add}
                disabled={busy}
                className="bg-amber-300 text-black hover:bg-amber-200"
              >
                <Plus /> Session
              </Button>
            )}
          </>
        }
      >
        {sessions.map((item) => {
          const open = playId === item.id || expanded.has(item.id);
          const linked = story.filter((beat) =>
            beat.sessionIds.includes(item.id),
          );
          return (
            <article
              id={`session-${item.id}`}
              tabIndex={-1}
              key={item.id}
              hidden={
                playId
                  ? playId !== item.id
                  : !visible.some(({ id }) => id === item.id)
              }
              className="rounded-xl border border-white/10 bg-[#13161d]"
            >
              <button
                type="button"
                className="record-row flex w-full items-center gap-3 p-4 text-left"
                aria-expanded={open}
                onClick={() => toggle(item.id)}
              >
                {open ? (
                  <ChevronDown className="size-4" />
                ) : (
                  <ChevronRight className="size-4" />
                )}
                <span className="min-w-0 flex-1 truncate font-medium">
                  {item.title || "Untitled session"}
                </span>
                <span className="hidden text-xs text-stone-400 sm:block">
                  {item.date}
                </span>
                <SaveStatus
                  dirty={dirty.has(item.id) || encounterDirty.has(item.id)}
                  saving={savingSession === item.id}
                  label={`Session ${item.title}`}
                />
                <StatusBadge status={item.status} />
              </button>
              {visited.has(item.id) && (
                <div
                  hidden={!open}
                  className="border-t border-white/10 p-4 sm:p-5"
                >
                  <div className="grid gap-3 sm:grid-cols-[1fr_11rem_10rem]">
                    <Input
                      aria-label="Session title"
                      value={item.title}
                      disabled={!editable}
                      onChange={(event) =>
                        patch(item.id, { title: event.target.value })
                      }
                    />
                    <Input
                      type="date"
                      aria-label="Session date"
                      value={item.date}
                      disabled={!editable}
                      onChange={(event) =>
                        patch(item.id, { date: event.target.value })
                      }
                    />
                    <StatusSelect
                      value={item.status}
                      disabled={!editable}
                      onChange={(status) => patch(item.id, { status })}
                    />
                  </div>
                  <Tabs.Root
                    defaultValue={(() => {
                      try {
                        return userId &&
                          readDraft(
                            localStorage,
                            draftKey(userId, campaignId, `prepared:${item.id}`),
                          )
                          ? "encounters"
                          : "notes";
                      } catch {
                        return "notes";
                      }
                    })()}
                    className={
                      playId === item.id
                        ? "mt-4 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"
                        : "mt-4"
                    }
                  >
                    <Tabs.List
                      aria-label={`Workspace for ${item.title}`}
                      className={
                        playId === item.id
                          ? "hidden"
                          : "flex flex-wrap gap-1 rounded-lg bg-black/20 p-1"
                      }
                    >
                      <Tabs.Trigger value="notes" className={sessionTabClass}>
                        Notes
                      </Tabs.Trigger>
                      <Tabs.Trigger
                        value="encounters"
                        className={sessionTabClass}
                      >
                        Encounters ({encounterCounts[item.id] ?? 0})
                        {encounterDirty.has(item.id) ? " •" : ""}
                      </Tabs.Trigger>
                      <Tabs.Trigger value="stories" className={sessionTabClass}>
                        Linked stories ({linked.length})
                      </Tabs.Trigger>
                    </Tabs.List>
                    <Tabs.Content
                      value="notes"
                      forceMount
                      className={
                        playId === item.id
                          ? "rounded-lg border border-white/10 p-4 lg:col-start-1 lg:row-start-1"
                          : "mt-4 data-[state=inactive]:hidden"
                      }
                    >
                      <div>
                        <h3 className="mb-2 text-sm font-medium">
                          Preparation notes
                        </h3>
                        {playId === item.id && (
                          <h3 className="mb-3 font-medium">Session notes</h3>
                        )}
                        {editable ? (
                          <RichTextEditor
                            value={item.notes}
                            onChange={(notes) => patch(item.id, { notes })}
                            onPasteImage={uploadScreenshot}
                            placeholder="Session notes…"
                            className="min-h-48"
                          />
                        ) : (
                          <RichTextContent value={item.notes} />
                        )}
                      </div>
                      <SessionContinuityEditor
                        campaign={campaign}
                        players={players}
                        value={item.continuity ?? emptyContinuity()}
                        editable={editable && !busy}
                        update={(continuity) => patch(item.id, { continuity })}
                      />
                    </Tabs.Content>
                    <Tabs.Content
                      value="stories"
                      forceMount
                      className={
                        playId === item.id
                          ? "rounded-lg border border-white/10 p-4 lg:col-start-1 lg:row-start-2"
                          : "mt-4 data-[state=inactive]:hidden"
                      }
                    >
                      {playId === item.id && (
                        <h3 className="mb-3 font-medium">Linked stories</h3>
                      )}
                      {linked.length ? (
                        <div className="mt-4 flex flex-wrap items-center gap-2">
                          {linked.map((beat) => (
                            <div
                              key={beat.id}
                              className={
                                playId === item.id
                                  ? "w-full rounded border border-white/10 p-3"
                                  : "contents"
                              }
                            >
                              <button
                                className="rounded-full bg-violet-400/10 px-3 py-1 text-xs text-violet-300 hover:bg-violet-400/20"
                                key={beat.id}
                                onClick={() => onOpenStory(beat.id)}
                              >
                                {beat.title}{" "}
                                <StatusBadge status={beat.status} />
                              </button>
                              {playId === item.id && (
                                <RichTextContent value={beat.details} />
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-stone-400">
                          No stories linked to this session. Link a session from
                          the Story workspace.
                        </p>
                      )}
                    </Tabs.Content>
                    <Tabs.Content
                      value="encounters"
                      forceMount
                      className={
                        playId === item.id
                          ? "min-w-0 lg:col-start-2 lg:row-start-1 lg:row-span-3"
                          : "data-[state=inactive]:hidden"
                      }
                    >
                      <PreparedEncounters
                        campaignId={campaignId}
                        attendanceIds={item.continuity?.attendanceIds ?? []}
                        sessionId={item.id}
                        editable={editable}
                        onOpenCombat={onOpenCombat}
                        registerSave={registerEncounterSaver}
                        onDirtyChange={markEncounterDirty}
                        onCountChange={updateEncounterCount}
                        savingSession={savingSession === item.id}
                      />
                    </Tabs.Content>
                    {playId === item.id && (
                      <SessionRoster campaignId={campaignId} />
                    )}
                  </Tabs.Root>
                  {!editable && (
                    <div className="mt-4 flex justify-end">
                      <PrintPacketButton
                        campaignId={campaignId}
                        sessionId={item.id}
                        disabled={busy}
                      />
                    </div>
                  )}
                  {editable && (
                    <div className="sticky bottom-0 z-10 mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-white/10 bg-[#13161d]/95 py-3 backdrop-blur">
                      <Button
                        variant="ghost"
                        onClick={() => saveTemplate(item)}
                      >
                        <FilePlus /> Save template
                      </Button>
                      <PrintPacketButton
                        campaignId={campaignId}
                        sessionId={item.id}
                        disabled={
                          busy ||
                          dirty.has(item.id) ||
                          encounterDirty.has(item.id)
                        }
                      />
                      <Button
                        variant="outline"
                        disabled={
                          busy ||
                          dirty.has(item.id) ||
                          encounterDirty.has(item.id)
                        }
                        title="Save session and encounters before carrying items forward"
                        onClick={() => setCarry(item)}
                      >
                        Prepare next session
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => remove(item)}
                        disabled={busy}
                      >
                        <Trash2 /> Delete
                      </Button>
                      <Button onClick={() => save(item)} disabled={busy}>
                        <Save /> Save session &amp; encounters
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </article>
          );
        })}
        {!visible.length && <Empty>No sessions match this search.</Empty>}
      </Section>
      {carry && (
        <CarryDialog
          session={carry}
          close={() => setCarry(null)}
          created={(item) => {
            setSessions((all) => [item, ...all]);
            setExpanded(new Set([item.id]));
            setVisited((all) => new Set(all).add(item.id));
            setPlayId(null);
          }}
        />
      )}
      <Dialog open={templatesOpen} onOpenChange={setTemplatesOpen}>
        <DialogContent className="border-white/10 bg-[#151820] text-stone-100">
          <DialogHeader>
            <DialogTitle>Session templates</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {templates.map((template) => (
              <div
                key={template.id}
                className="flex items-center gap-2 rounded-lg border border-white/10 p-3"
              >
                <button
                  className="min-w-0 flex-1 truncate text-left hover:text-amber-200"
                  onClick={() => applyTemplate(template)}
                >
                  {template.name}
                </button>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  onClick={async () => {
                    await deleteSessionTemplate(template.id);
                    setTemplates((all) =>
                      all.filter(({ id }) => id !== template.id),
                    );
                  }}
                >
                  <Trash2 />
                </Button>
              </div>
            ))}
            {!templates.length && (
              <p className="text-sm text-stone-400">No templates saved yet.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
