"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, ChevronsUpDown, FilePlus, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RichTextContent, RichTextEditor, richTextToPlainText } from "@/features/rich-text/rich-text";
import { createV6Session, deleteV6Session, deleteV6SessionTemplate, listV6Sessions, listV6SessionTemplates, listV6Story, saveV6SessionTemplate, updateV6Session, uploadV6Screenshot } from "./api-client";
import { PreparedEncounters } from "./prepared-encounters";
import { StatusBadge, StatusSelect } from "./progress-status";
import type { V6Session, V6SessionTemplate, V6StoryBeat } from "./types";

export function SessionsScreen({ campaignId, editable, initialOpenId, onOpenStory, onOpenCombat }: { campaignId: string; editable: boolean; initialOpenId?: string; onOpenStory: (id: string) => void; onOpenCombat: () => void }) {
  const [sessions, setSessions] = useState<V6Session[]>([]);
  const [story, setStory] = useState<V6StoryBeat[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(initialOpenId ? [initialOpenId] : []));
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [templates, setTemplates] = useState<V6SessionTemplate[]>([]);

  useEffect(() => { let live = true; void Promise.all([listV6Sessions(campaignId), listV6Story(campaignId)]).then(([nextSessions, nextStory]) => { if (live) { setSessions(nextSessions); setStory(nextStory); } }).catch(report); return () => { live = false; }; }, [campaignId]);
  function report(error: unknown) { toast.error(error instanceof Error ? error.message : "Session update failed."); }
  const visible = useMemo(() => { const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean); return sessions.filter((item) => terms.every((term) => `${item.title} ${item.date} ${richTextToPlainText(item.notes)}`.toLowerCase().includes(term))); }, [query, sessions]);
  function patch(id: string, values: Partial<V6Session>) { setSessions((all) => all.map((item) => item.id === id ? { ...item, ...values } : item)); }
  async function add() { setBusy(true); try { const item = await createV6Session(campaignId, { title: "New session", date: new Date().toISOString().slice(0, 10), notes: "", status: "planned", sortOrder: sessions.length }); setSessions((all) => [item, ...all]); setExpanded(new Set([item.id])); } catch (error) { report(error); } finally { setBusy(false); } }
  async function save(item: V6Session) { setBusy(true); try { const saved = await updateV6Session(campaignId, item); patch(saved.id, saved); toast.success("Session saved"); } catch (error) { report(error); } finally { setBusy(false); } }
  async function remove(item: V6Session) { if (!window.confirm(`Delete ${item.title}?`)) return; setBusy(true); try { await deleteV6Session(campaignId, item.id); setSessions((all) => all.filter(({ id }) => id !== item.id)); setStory((all) => all.map((beat) => ({ ...beat, sessionIds: beat.sessionIds.filter((id) => id !== item.id) }))); } catch (error) { report(error); } finally { setBusy(false); } }
  function toggle(id: string) { setExpanded((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; }); }
  const allOpen = visible.length > 0 && visible.every(({ id }) => expanded.has(id));
  async function openTemplates() { setTemplatesOpen(true); try { setTemplates(await listV6SessionTemplates()); } catch (error) { report(error); } }
  async function applyTemplate(template: V6SessionTemplate) { try { const value = JSON.parse(template.content) as Partial<V6Session>; const item = await createV6Session(campaignId, { title: value.title || template.name, date: new Date().toISOString().slice(0, 10), notes: value.notes ?? "", status: "planned", sortOrder: sessions.length }); setSessions((all) => [item, ...all]); setExpanded(new Set([item.id])); setTemplatesOpen(false); } catch (error) { report(error); } }
  async function saveTemplate(item: V6Session) { const name = window.prompt("Template name:", item.title)?.trim(); if (!name) return; try { const template = await saveV6SessionTemplate(name, JSON.stringify({ title: item.title, notes: item.notes })); setTemplates((all) => [template, ...all]); toast.success("Session template saved"); } catch (error) { report(error); } }

  return <><Section title="Sessions" description="Plan sessions, record outcomes, and prepare encounters." query={query} setQuery={setQuery} actions={<><Button variant="outline" onClick={() => setExpanded(allOpen ? new Set() : new Set(visible.map(({ id }) => id)))}><ChevronsUpDown /> {allOpen ? "Collapse all" : "Expand all"}</Button>{editable && <Button variant="outline" onClick={openTemplates}><FilePlus /> Templates</Button>}{editable && <Button onClick={add} disabled={busy} className="bg-amber-300 text-black hover:bg-amber-200"><Plus /> Session</Button>}</>}>
    {visible.map((item) => { const open = expanded.has(item.id); const linked = story.filter((beat) => beat.sessionIds.includes(item.id)); return <article key={item.id} className="rounded-xl border border-white/10 bg-[#13161d]">
      <button type="button" className="flex w-full items-center gap-3 p-4 text-left" onClick={() => toggle(item.id)}>{open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}<span className="min-w-0 flex-1 truncate font-medium">{item.title || "Untitled session"}</span><span className="hidden text-xs text-stone-500 sm:block">{item.date}</span><StatusBadge status={item.status} /></button>
      {open && <div className="border-t border-white/10 p-4 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-[1fr_11rem_10rem]"><Input value={item.title} disabled={!editable} onChange={(event) => patch(item.id, { title: event.target.value })} /><Input type="date" value={item.date} disabled={!editable} onChange={(event) => patch(item.id, { date: event.target.value })} /><StatusSelect value={item.status} disabled={!editable} onChange={(status) => patch(item.id, { status })} /></div>
        <div className="mt-4">{editable ? <RichTextEditor value={item.notes} onChange={(notes) => patch(item.id, { notes })} onPasteImage={uploadV6Screenshot} placeholder="Session notes…" className="min-h-48" /> : <RichTextContent value={item.notes} />}</div>
        {!!linked.length && <div className="mt-4 flex flex-wrap items-center gap-2"><span className="text-xs text-stone-500">Linked story:</span>{linked.map((beat) => <button className="rounded-full bg-violet-400/10 px-3 py-1 text-xs text-violet-300 hover:bg-violet-400/20" key={beat.id} onClick={() => onOpenStory(beat.id)}>{beat.title}</button>)}</div>}
        <PreparedEncounters campaignId={campaignId} sessionId={item.id} editable={editable} onOpenCombat={onOpenCombat} />
        {editable && <div className="mt-4 flex justify-end gap-2"><Button variant="ghost" onClick={() => saveTemplate(item)}><FilePlus /> Save template</Button><Button variant="ghost" onClick={() => remove(item)} disabled={busy}><Trash2 /> Delete</Button><Button onClick={() => save(item)} disabled={busy}><Save /> Save</Button></div>}
      </div>}
    </article>; })}
    {!visible.length && <Empty>No sessions match this search.</Empty>}
  </Section><Dialog open={templatesOpen} onOpenChange={setTemplatesOpen}><DialogContent className="border-white/10 bg-[#151820] text-stone-100"><DialogHeader><DialogTitle>Session templates</DialogTitle></DialogHeader><div className="space-y-2">{templates.map((template) => <div key={template.id} className="flex items-center gap-2 rounded-lg border border-white/10 p-3"><button className="min-w-0 flex-1 truncate text-left hover:text-amber-200" onClick={() => applyTemplate(template)}>{template.name}</button><Button size="icon-sm" variant="ghost" onClick={async () => { await deleteV6SessionTemplate(template.id); setTemplates((all) => all.filter(({ id }) => id !== template.id)); }}><Trash2 /></Button></div>)}{!templates.length && <p className="text-sm text-stone-500">No templates saved yet.</p>}</div></DialogContent></Dialog></>;
}

export function Section({ title, description, query, setQuery, actions, children }: { title: string; description: string; query: string; setQuery: (value: string) => void; actions: React.ReactNode; children: React.ReactNode }) {
  return <div className="mx-auto w-full max-w-[1500px] space-y-5"><header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">Campaign workspace</p><h1 className="mt-1 font-serif text-3xl">{title}</h1><p className="mt-1 text-sm text-stone-500">{description}</p></div><div className="flex flex-col gap-2 sm:flex-row"><Input className="sm:w-72" type="search" placeholder={`Search ${title.toLowerCase()}…`} value={query} onChange={(event) => setQuery(event.target.value)} />{actions}</div></header><div className="space-y-3">{children}</div></div>;
}
export function Empty({ children }: { children: React.ReactNode }) { return <p className="rounded-xl border border-dashed border-white/10 p-10 text-center text-sm text-stone-600">{children}</p>; }
