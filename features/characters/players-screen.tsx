"use client";
import { isDraftDirty } from "@/features/shared/draft-state";

import { deleteRecords } from "../shared/api-client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  RosterFilter,
  type RosterFilterValue,
} from "@/features/shared/roster-filter";
import { SaveStatus } from "@/features/shared/save-status";
import { useUnsavedChanges } from "@/features/shared/unsaved-changes";
import { reconcileSaved } from "@/features/encounters/drafts";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  RichTextContent,
  RichTextEditor,
  richTextToPlainText,
} from "@/features/rich-text/rich-text";
import {
  createPlayer,
  listPlayers,
  updatePlayer,
  uploadScreenshot,
} from "../shared/api-client";
import { Empty, Section } from "@/features/shared/record-section";
import type { Player } from "@/domain/types";

export function PlayersScreen({
  campaignId,
  editable,
  initialOpenId,
}: {
  campaignId: string;
  editable: boolean;
  initialOpenId?: string;
}) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<Player | null>(null);
  const [kindFilter, setKindFilter] = useState<RosterFilterValue>("all");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const pendingSave = useRef(false);
  const isNew = editing?.id.startsWith("draft:") ?? false;
  const dirty =
    !!editing &&
    (isNew
      ? Boolean(
          editing.name ||
          editing.race ||
          editing.className ||
          editing.notes ||
          editing.level !== null ||
          editing.hitPoints !== null ||
          editing.armorClass !== null,
        )
      : isDraftDirty(
          editing,
          players.find(({ id }) => id === editing.id),
        ));
  useUnsavedChanges(dirty);
  useEffect(() => {
    let live = true;
    void listPlayers(campaignId)
      .then((items) => {
        if (live) {
          setPlayers(items);
          if (initialOpenId)
            setEditing(items.find(({ id }) => id === initialOpenId) ?? null);
        }
      })
      .catch(report);
    return () => {
      live = false;
    };
  }, [campaignId, initialOpenId]);
  function report(error: unknown) {
    toast.error(
      error instanceof Error ? error.message : "Player update failed.",
    );
  }
  const visible = useMemo(() => {
    const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
    return players.filter(
      (item) =>
        (kindFilter === "all" || (item.kind ?? "player") === kindFilter) &&
        terms.every((term) =>
          `${item.name} ${item.kind ?? "player"} ${item.race} ${item.className} ${richTextToPlainText(item.notes)}`
            .toLowerCase()
            .includes(term),
        ),
    );
  }, [players, query, kindFilter]);
  function add(kind: "player" | "npc") {
    setEditing({
      id: `draft:${crypto.randomUUID()}`,
      campaignId,
      kind,
      name: "",
      race: "",
      className: "",
      level: null,
      hitPoints: null,
      armorClass: null,
      notes: "",
      revision: 0,
      createdAt: "",
      updatedAt: "",
    });
  }
  async function save() {
    if (!editing || pendingSave.current || !editing.name.trim()) return;
    pendingSave.current = true;
    setSaving(true);
    setBusy(true);
    try {
      const input = { ...editing, name: editing.name.trim() };
      const {
        name,
        kind,
        race,
        className,
        level,
        hitPoints,
        armorClass,
        notes,
      } = input;
      const saved = isNew
        ? await createPlayer(campaignId, {
            name,
            kind,
            race,
            className,
            level,
            hitPoints,
            armorClass,
            notes,
          })
        : await updatePlayer(campaignId, input);
      setPlayers((all) =>
        isNew
          ? [...all, saved]
          : all.map((item) => (item.id === saved.id ? saved : item)),
      );
      setEditing((current) =>
        current?.id === editing.id
          ? {
              ...reconcileSaved(current, editing, saved),
              id: saved.id,
              createdAt: saved.createdAt,
              updatedAt: saved.updatedAt,
            }
          : current,
      );
      toast.success("Player / NPC saved");
    } catch (error) {
      report(error);
    } finally {
      pendingSave.current = false;
      setSaving(false);
      setBusy(false);
    }
  }
  async function remove(ids: string[]) {
    if (
      !ids.length ||
      !window.confirm(
        `Delete ${ids.length} player${ids.length === 1 ? "" : "s"}?`,
      )
    )
      return;
    setBusy(true);
    try {
      await deleteRecords(campaignId, "players", ids);
      setPlayers((all) => all.filter(({ id }) => !ids.includes(id)));
      setSelected(new Set());
      if (editing && ids.includes(editing.id)) setEditing(null);
    } catch (error) {
      report(error);
    } finally {
      setBusy(false);
    }
  }
  function number(value: string, min: number): number | null {
    return value === "" ? null : Math.max(min, Number(value));
  }

  return (
    <>
      <Section
        title="Players / NPC’s"
        description="Manage the players and NPCs in this campaign."
        query={query}
        setQuery={setQuery}
        actions={
          <>
            {editable && selected.size > 0 && (
              <Button variant="outline" onClick={() => remove([...selected])}>
                <Trash2 /> Delete ({selected.size})
              </Button>
            )}
            {editable && (
              <Button onClick={() => add("npc")} disabled={busy}>
                <Plus /> NPC
              </Button>
            )}
            {editable && (
              <Button
                onClick={() => add("player")}
                disabled={busy}
                className="bg-amber-300 text-black hover:bg-amber-200"
              >
                <Plus /> Player
              </Button>
            )}
          </>
        }
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <RosterFilter value={kindFilter} onChange={setKindFilter} />
          <p role="status" className="text-sm text-stone-400">
            {visible.length} of {players.length} records · {selected.size}{" "}
            selected
          </p>
        </div>
        <div className="overflow-hidden rounded-xl border border-white/10 bg-[#13161d]">
          <div className="record-row grid grid-cols-[2rem_minmax(0,1fr)_5rem] md:grid-cols-[2.5rem_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_4rem_5rem] gap-3 border-b border-white/10 px-4 py-3 text-xs uppercase tracking-wider text-stone-400">
            <span />
            <span>Name</span>
            <span className="hidden md:block">Race</span>
            <span className="hidden md:block">Class</span>
            <span className="hidden md:block">Level</span>
            <span>HP / AC</span>
          </div>
          {visible.map((player) => (
            <div
              key={player.id}
              className="record-row grid grid-cols-[2rem_minmax(0,1fr)_5rem] md:grid-cols-[2.5rem_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_4rem_5rem] items-center gap-3 border-b border-white/5 px-4 py-3 text-sm last:border-0"
            >
              <Checkbox
                aria-label={`Select ${player.name}`}
                checked={selected.has(player.id)}
                disabled={!editable}
                onCheckedChange={(checked) =>
                  setSelected((current) => {
                    const next = new Set(current);
                    if (checked) next.add(player.id);
                    else next.delete(player.id);
                    return next;
                  })
                }
              />
              <button
                className={`min-w-0 text-left font-medium hover:underline ${player.kind === "npc" ? "text-blue-300" : "text-emerald-300"}`}
                onClick={() => setEditing(player)}
              >
                <span className="block truncate md:inline">{player.name}</span>
                <span
                  className={`ml-2 rounded px-2 py-0.5 text-xs ${player.kind === "npc" ? "bg-blue-500/10 text-blue-300" : "bg-emerald-500/10 text-emerald-300"}`}
                >
                  {player.kind === "npc" ? "NPC" : "Player"}
                </span>
                <span className="mt-1 block truncate text-xs font-normal text-stone-400 md:hidden">
                  {[
                    player.race,
                    player.className,
                    player.level ? `Level ${player.level}` : "",
                  ]
                    .filter(Boolean)
                    .join(" · ") || "No race or class set"}
                </span>
              </button>
              <span className="hidden truncate text-stone-400 md:block">
                {player.race || "—"}
              </span>
              <span className="hidden truncate text-stone-400 md:block">
                {player.className || "—"}
              </span>
              <span className="hidden md:block">{player.level ?? "—"}</span>
              <span>
                {player.hitPoints ?? "—"} / {player.armorClass ?? "—"}
              </span>
            </div>
          ))}
        </div>
        {!visible.length && (
          <Empty>No players or NPCs match this search.</Empty>
        )}
      </Section>
      <Dialog
        open={!!editing}
        onOpenChange={(open) => {
          if (
            !open &&
            !saving &&
            (!dirty ||
              window.confirm("Discard the unsaved changes to this record?"))
          )
            setEditing(null);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto border-white/10 bg-[#151820] text-stone-100 sm:max-w-2xl">
          {editing && (
            <>
              <DialogHeader>
                <DialogTitle className="font-serif text-2xl">
                  {editable
                    ? isNew
                      ? "New player / NPC"
                      : "Edit player / NPC"
                    : editing.name}
                </DialogTitle>
              </DialogHeader>
              {isNew && (
                <p className="text-sm text-stone-400">
                  This draft is added to the campaign only when you save it.
                </p>
              )}
              <Field label="Type">
                <select
                  aria-label="Type"
                  value={editing.kind ?? "player"}
                  disabled={!editable}
                  onChange={(event) =>
                    setEditing({
                      ...editing,
                      kind: event.target.value as "player" | "npc",
                    })
                  }
                  className="mt-1 rounded border border-white/10 bg-[#151820] p-2"
                >
                  <option value="player">Player</option>
                  <option value="npc">NPC</option>
                </select>
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Name">
                  <Input
                    aria-label="Name"
                    maxLength={120}
                    required
                    autoFocus
                    value={editing.name}
                    disabled={!editable}
                    onChange={(event) =>
                      setEditing({ ...editing, name: event.target.value })
                    }
                  />
                </Field>
                <Field label="Race">
                  <Input
                    aria-label="Race"
                    value={editing.race}
                    disabled={!editable}
                    onChange={(event) =>
                      setEditing({ ...editing, race: event.target.value })
                    }
                  />
                </Field>
                <Field label="Class">
                  <Input
                    aria-label="Class"
                    value={editing.className}
                    disabled={!editable}
                    onChange={(event) =>
                      setEditing({ ...editing, className: event.target.value })
                    }
                  />
                </Field>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Level">
                  <Input
                    aria-label="Level"
                    type="number"
                    min={1}
                    max={20}
                    value={editing.level ?? ""}
                    disabled={!editable}
                    onChange={(event) =>
                      setEditing({
                        ...editing,
                        level: number(event.target.value, 1),
                      })
                    }
                  />
                </Field>
                <Field label="Hit points">
                  <Input
                    aria-label="Hit points"
                    type="number"
                    min={0}
                    value={editing.hitPoints ?? ""}
                    disabled={!editable}
                    onChange={(event) =>
                      setEditing({
                        ...editing,
                        hitPoints: number(event.target.value, 0),
                      })
                    }
                  />
                </Field>
                <Field label="Armor class">
                  <Input
                    aria-label="Armor class"
                    type="number"
                    min={0}
                    value={editing.armorClass ?? ""}
                    disabled={!editable}
                    onChange={(event) =>
                      setEditing({
                        ...editing,
                        armorClass: number(event.target.value, 0),
                      })
                    }
                  />
                </Field>
              </div>
              <Field label="Notes">
                {editable ? (
                  <RichTextEditor
                    value={editing.notes}
                    onChange={(notes) => setEditing({ ...editing, notes })}
                    onPasteImage={uploadScreenshot}
                    placeholder="Player / NPC notes…"
                    className="min-h-40"
                  />
                ) : (
                  <RichTextContent value={editing.notes} />
                )}
              </Field>
              {editable && (
                <div className="sticky bottom-0 z-10 flex items-center justify-between border-t border-white/10 bg-[#151820]/95 py-3 backdrop-blur">
                  {isNew ? (
                    <Button
                      variant="ghost"
                      disabled={saving}
                      onClick={() => {
                        if (
                          !dirty ||
                          window.confirm("Discard this unsaved record?")
                        )
                          setEditing(null);
                      }}
                    >
                      Cancel
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      onClick={() => remove([editing.id])}
                    >
                      <Trash2 /> Delete
                    </Button>
                  )}
                  <SaveStatus
                    dirty={isNew || dirty}
                    saving={saving}
                    label="Player / NPC"
                  />
                  <Button
                    onClick={save}
                    disabled={busy || !editing.name.trim()}
                  >
                    <Save /> Save
                  </Button>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="block text-xs text-stone-400">
      <span>{label}</span>
      <div className="mt-1">{children}</div>
    </div>
  );
}
