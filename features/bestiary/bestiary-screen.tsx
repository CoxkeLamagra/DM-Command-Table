"use client";
import { isDraftDirty } from "@/features/shared/draft-state";

import { deleteRecords } from "../shared/api-client";

import { useEffect, useMemo, useState } from "react";
import { Heart, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { SaveStatus } from "@/features/shared/save-status";
import { useDraftRecovery } from "../shared/draft-recovery";
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
  createMonster,
  listMonsters,
  updateMonster,
  uploadScreenshot,
} from "../shared/api-client";
import { Empty, Section } from "@/features/shared/record-section";
import type { Monster } from "@/domain/types";
import { BestiaryImport } from "./bestiary-import";

export function BestiaryScreen({
  campaignId,
  editable,
  initialOpenId,
}: {
  campaignId: string;
  editable: boolean;
  initialOpenId?: string;
}) {
  const [monsters, setMonsters] = useState<Monster[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<Monster | null>(null);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const dirty =
    !!editing &&
    isDraftDirty(
      editing,
      monsters.find(({ id }) => id === editing.id),
    );
  useUnsavedChanges(dirty);
  const [loaded, setLoaded] = useState(false);
  const recovery = useDraftRecovery({
    campaignId,
    scope: "bestiary",
    value: editing,
    dirty,
    ready: loaded && editable,
    restore: (value) => {
      if (
        !value ||
        typeof value.id !== "string" ||
        typeof value.name !== "string" ||
        typeof value.notes !== "string"
      )
        throw new Error("Invalid draft");
      if (
        !value.id.startsWith("draft:") &&
        !monsters.some(({ id }) => id === value.id)
      )
        throw new Error(
          "The record was removed. Download this draft to recover its text.",
        );
      setEditing(value);
    },
  });
  useEffect(() => {
    let live = true;
    void listMonsters(campaignId)
      .then((items) => {
        if (live) {
          setMonsters(items);
          setLoaded(true);
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
      error instanceof Error ? error.message : "Bestiary update failed.",
    );
  }
  const visible = useMemo(() => {
    const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
    return monsters.filter((item) =>
      terms.every((term) =>
        `${item.name} ${item.type} ${item.challengeRating} ${item.source ?? ""} ${richTextToPlainText(item.notes)}`
          .toLowerCase()
          .includes(term),
      ),
    );
  }, [monsters, query]);
  const allVisibleSelected =
    visible.length > 0 && visible.every(({ id }) => selected.has(id));
  const someVisibleSelected = visible.some(({ id }) => selected.has(id));
  async function add() {
    setBusy(true);
    try {
      const item = await createMonster(campaignId);
      setMonsters((all) => [...all, item]);
      setEditing(item);
    } catch (error) {
      report(error);
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    if (!editing || saving) return;
    setSaving(true);
    setBusy(true);
    try {
      const saved = await updateMonster(campaignId, editing);
      setMonsters((all) =>
        all.map((item) => (item.id === saved.id ? saved : item)),
      );
      setEditing((current) =>
        current?.id === saved.id
          ? reconcileSaved(current, editing, saved)
          : current,
      );
      toast.success("Monster saved");
    } catch (error) {
      report(error);
    } finally {
      setSaving(false);
      setBusy(false);
    }
  }
  async function remove(ids: string[]) {
    if (
      !ids.length ||
      !window.confirm(
        `Delete ${ids.length} monster${ids.length === 1 ? "" : "s"}?`,
      )
    )
      return;
    setBusy(true);
    try {
      await deleteRecords(campaignId, "monsters", ids);
      setMonsters((all) => all.filter(({ id }) => !ids.includes(id)));
      setSelected(new Set());
      if (editing && ids.includes(editing.id)) setEditing(null);
    } catch (error) {
      report(error);
    } finally {
      setBusy(false);
    }
  }
  async function favorite(monster: Monster) {
    try {
      const saved = await updateMonster(campaignId, {
        ...monster,
        favorite: !monster.favorite,
      });
      setMonsters((all) =>
        all.map((item) => (item.id === saved.id ? saved : item)),
      );
    } catch (error) {
      report(error);
    }
  }
  function nonnegative(value: string) {
    return Math.max(0, Number(value) || 0);
  }

  return (
    <>
      {recovery.banner}
      <Section
        title="Bestiary"
        description="Search and maintain local monster stat blocks."
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
              <BestiaryImport
                campaignId={campaignId}
                monsters={monsters}
                complete={setMonsters}
              />
            )}
            {editable && (
              <Button
                onClick={add}
                disabled={busy}
                className="bg-amber-300 text-black hover:bg-amber-200"
              >
                <Plus /> Monster
              </Button>
            )}
          </>
        }
      >
        <div className="overflow-hidden rounded-xl border border-white/10 bg-[#13161d]">
          <div className="record-row grid grid-cols-[2rem_2rem_minmax(0,1fr)_3rem] md:grid-cols-[2.5rem_2.5rem_minmax(0,1.5fr)_minmax(0,1fr)_4rem_4rem_4rem] items-center gap-3 border-b border-white/10 px-4 py-3 text-xs uppercase tracking-wider text-stone-400">
            <Checkbox
              aria-label="Select all visible monsters"
              title="Select all visible monsters"
              checked={
                allVisibleSelected
                  ? true
                  : someVisibleSelected
                    ? "indeterminate"
                    : false
              }
              disabled={!editable || visible.length === 0}
              onCheckedChange={(checked) =>
                setSelected((current) => {
                  const next = new Set(current);
                  for (const { id } of visible) {
                    if (checked) next.add(id);
                    else next.delete(id);
                  }
                  return next;
                })
              }
            />
            <span />
            <span>Name</span>
            <span className="hidden md:block">Type</span>
            <span>CR</span>
            <span className="hidden md:block">HP</span>
            <span className="hidden md:block">AC</span>
          </div>
          {visible.map((monster) => (
            <div
              key={monster.id}
              className="record-row grid grid-cols-[2rem_2rem_minmax(0,1fr)_3rem] md:grid-cols-[2.5rem_2.5rem_minmax(0,1.5fr)_minmax(0,1fr)_4rem_4rem_4rem] items-center gap-3 border-b border-white/5 px-4 py-3 text-sm last:border-0"
            >
              <Checkbox
                checked={selected.has(monster.id)}
                disabled={!editable}
                onCheckedChange={(checked) =>
                  setSelected((current) => {
                    const next = new Set(current);
                    if (checked) next.add(monster.id);
                    else next.delete(monster.id);
                    return next;
                  })
                }
              />
              <button
                disabled={!editable}
                title="Toggle favorite"
                onClick={() => favorite(monster)}
                className={
                  monster.favorite ? "text-rose-400" : "text-stone-700"
                }
              >
                <Heart
                  className={`size-4 ${monster.favorite ? "fill-current" : ""}`}
                />
              </button>
              <button
                className="truncate text-left font-medium text-amber-200 hover:underline"
                onClick={() => setEditing(monster)}
              >
                <span className="block truncate">{monster.name}</span>
                <span className="mt-1 block truncate text-xs font-normal text-stone-400 md:hidden">
                  {monster.type || "Unknown type"} · HP {monster.hitPoints} · AC{" "}
                  {monster.armorClass}
                </span>
              </button>
              <span className="hidden truncate text-stone-400 md:block">
                {monster.type || "—"}
              </span>
              <span>{monster.challengeRating || "—"}</span>
              <span className="hidden md:block">{monster.hitPoints}</span>
              <span className="hidden md:block">{monster.armorClass}</span>
            </div>
          ))}
        </div>
        {!visible.length && <Empty>No monsters match this search.</Empty>}
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
        <DialogContent className="max-h-[90vh] overflow-y-auto border-white/10 bg-[#151820] text-stone-100 sm:max-w-3xl">
          {editing && (
            <>
              <DialogHeader>
                <DialogTitle className="font-serif text-2xl">
                  {editable ? "Edit monster" : editing.name}
                </DialogTitle>
              </DialogHeader>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Name">
                  <Input
                    aria-label="Name"
                    value={editing.name}
                    disabled={!editable}
                    onChange={(event) =>
                      setEditing({ ...editing, name: event.target.value })
                    }
                  />
                </Field>
                <Field label="Creature type">
                  <Input
                    aria-label="Creature type"
                    value={editing.type}
                    disabled={!editable}
                    onChange={(event) =>
                      setEditing({ ...editing, type: event.target.value })
                    }
                  />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Field label="Challenge rating">
                  <Input
                    aria-label="Challenge rating"
                    value={editing.challengeRating}
                    disabled={!editable}
                    onChange={(event) =>
                      setEditing({
                        ...editing,
                        challengeRating: event.target.value,
                      })
                    }
                  />
                </Field>
                <Field label="Armor class">
                  <Input
                    aria-label="Armor class"
                    type="number"
                    min={0}
                    value={editing.armorClass}
                    disabled={!editable}
                    onChange={(event) =>
                      setEditing({
                        ...editing,
                        armorClass: nonnegative(event.target.value),
                      })
                    }
                  />
                </Field>
                <Field label="Hit points">
                  <Input
                    aria-label="Hit points"
                    type="number"
                    min={0}
                    value={editing.hitPoints}
                    disabled={!editable}
                    onChange={(event) =>
                      setEditing({
                        ...editing,
                        hitPoints: nonnegative(event.target.value),
                      })
                    }
                  />
                </Field>
                <Field label="Speed">
                  <Input
                    aria-label="Speed"
                    value={editing.speed}
                    disabled={!editable}
                    onChange={(event) =>
                      setEditing({ ...editing, speed: event.target.value })
                    }
                  />
                </Field>
              </div>
              <Field label="Ability scores">
                <RichArea
                  editable={editable}
                  value={editing.stats}
                  onChange={(stats) => setEditing({ ...editing, stats })}
                  placeholder="Ability scores…"
                />
              </Field>
              <Field label="Actions & traits">
                <RichArea
                  editable={editable}
                  value={editing.abilities}
                  onChange={(abilities) =>
                    setEditing({ ...editing, abilities })
                  }
                  placeholder="Actions and traits…"
                />
              </Field>
              <Field label="Spellcasting">
                <RichArea
                  editable={editable}
                  value={editing.spells}
                  onChange={(spells) => setEditing({ ...editing, spells })}
                  placeholder="Spellcasting…"
                />
              </Field>
              <Field label="Notes">
                <RichArea
                  editable={editable}
                  value={editing.notes}
                  onChange={(notes) => setEditing({ ...editing, notes })}
                  placeholder="Monster notes…"
                />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Source">
                  <Input
                    aria-label="Source"
                    value={editing.source ?? ""}
                    disabled={!editable}
                    onChange={(event) =>
                      setEditing({
                        ...editing,
                        source: event.target.value || null,
                      })
                    }
                  />
                </Field>
                <Field label="Spell slots (levels 1–9)">
                  <Input
                    aria-label="Spell slots (levels 1–9)"
                    value={editing.spellSlots.join(", ")}
                    disabled={!editable}
                    onChange={(event) =>
                      setEditing({
                        ...editing,
                        spellSlots: event.target.value
                          .split(",")
                          .map((value) => nonnegative(value.trim()))
                          .slice(0, 9),
                      })
                    }
                  />
                </Field>
              </div>
              {editable && (
                <div className="sticky bottom-0 z-10 flex items-center justify-between border-t border-white/10 bg-[#151820]/95 py-3 backdrop-blur">
                  <Button variant="ghost" onClick={() => remove([editing.id])}>
                    <Trash2 /> Delete
                  </Button>
                  <SaveStatus dirty={dirty} saving={saving} label="Monster" />
                  <Button onClick={save} disabled={busy}>
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
function RichArea({
  editable,
  value,
  onChange,
  placeholder,
}: {
  editable: boolean;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return editable ? (
    <RichTextEditor
      value={value}
      onChange={onChange}
      onPasteImage={uploadScreenshot}
      placeholder={placeholder}
      className="min-h-28"
    />
  ) : (
    <RichTextContent value={value} />
  );
}
