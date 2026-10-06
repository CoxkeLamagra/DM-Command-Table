"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
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
  createV6Player,
  deleteV6Player,
  listV6Players,
  updateV6Player,
  uploadV6Screenshot,
} from "./api-client";
import { Empty, Section } from "./sessions-screen";
import type { V6Player } from "./types";

export function PlayersScreen({
  campaignId,
  editable,
}: {
  campaignId: string;
  editable: boolean;
}) {
  const [players, setPlayers] = useState<V6Player[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<V6Player | null>(null);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let live = true;
    void listV6Players(campaignId)
      .then((items) => {
        if (live) setPlayers(items);
      })
      .catch(report);
    return () => {
      live = false;
    };
  }, [campaignId]);
  function report(error: unknown) {
    toast.error(
      error instanceof Error ? error.message : "Player update failed.",
    );
  }
  const visible = useMemo(() => {
    const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
    return players.filter((item) =>
      terms.every((term) =>
        `${item.name} ${item.race} ${item.className} ${richTextToPlainText(item.notes)}`
          .toLowerCase()
          .includes(term),
      ),
    );
  }, [players, query]);
  async function add() {
    setBusy(true);
    try {
      const item = await createV6Player(campaignId);
      setPlayers((all) => [...all, item]);
      setEditing(item);
    } catch (error) {
      report(error);
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    if (!editing) return;
    setBusy(true);
    try {
      const saved = await updateV6Player(campaignId, editing);
      setPlayers((all) =>
        all.map((item) => (item.id === saved.id ? saved : item)),
      );
      setEditing(saved);
      toast.success("Player saved");
    } catch (error) {
      report(error);
    } finally {
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
      for (const id of ids) await deleteV6Player(campaignId, id);
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
        title="Players"
        description="Manage the player characters in this campaign."
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
              <Button
                onClick={add}
                disabled={busy}
                className="bg-amber-300 text-black hover:bg-amber-200"
              >
                <Plus /> Player
              </Button>
            )}
          </>
        }
      >
        <div className="overflow-hidden rounded-xl border border-white/10 bg-[#13161d]">
          <div className="grid grid-cols-[2.5rem_1fr_1fr_1fr_5rem_5rem] gap-3 border-b border-white/10 px-4 py-3 text-xs uppercase tracking-wider text-stone-600">
            <span />
            <span>Name</span>
            <span>Race</span>
            <span>Class</span>
            <span>Level</span>
            <span>HP / AC</span>
          </div>
          {visible.map((player) => (
            <div
              key={player.id}
              className="grid grid-cols-[2.5rem_1fr_1fr_1fr_5rem_5rem] items-center gap-3 border-b border-white/5 px-4 py-3 text-sm last:border-0"
            >
              <Checkbox
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
                className="truncate text-left font-medium text-amber-200 hover:underline"
                onClick={() => setEditing(player)}
              >
                {player.name}
              </button>
              <span className="truncate text-stone-400">
                {player.race || "—"}
              </span>
              <span className="truncate text-stone-400">
                {player.className || "—"}
              </span>
              <span>{player.level ?? "—"}</span>
              <span>
                {player.hitPoints ?? "—"} / {player.armorClass ?? "—"}
              </span>
            </div>
          ))}
        </div>
        {!visible.length && <Empty>No players match this search.</Empty>}
      </Section>
      <Dialog
        open={!!editing}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto border-white/10 bg-[#151820] text-stone-100 sm:max-w-2xl">
          {editing && (
            <>
              <DialogHeader>
                <DialogTitle className="font-serif text-2xl">
                  {editable ? "Edit player" : editing.name}
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
              <Field label="Player notes">
                {editable ? (
                  <RichTextEditor
                    value={editing.notes}
                    onChange={(notes) => setEditing({ ...editing, notes })}
                    onPasteImage={uploadV6Screenshot}
                    placeholder="Player notes…"
                    className="min-h-40"
                  />
                ) : (
                  <RichTextContent value={editing.notes} />
                )}
              </Field>
              {editable && (
                <div className="flex justify-between">
                  <Button variant="ghost" onClick={() => remove([editing.id])}>
                    <Trash2 /> Delete
                  </Button>
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
    <div className="block text-xs text-stone-500">
      <span>{label}</span>
      <div className="mt-1">{children}</div>
    </div>
  );
}
