"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Download, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { MonsterDialog } from "./monster-dialog";
import {
  BESTIARY_BASE,
  convertRemoteMonster,
  getRemoteSummary,
  monsterIdentity,
  type FiveEToolsMonster,
  type RemoteMonsterRef,
} from "./fiveetools";
import { createId } from "@/features/campaign/id";
import type {
  CampaignPatch,
  CampaignState,
  Monster,
} from "@/features/campaign/types";
import { ScreenTitle, Stat } from "@/features/shared/ui";

const uid = createId;

export function Bestiary({
  data,
  patch,
}: {
  data: CampaignState;
  patch: CampaignPatch;
}) {
  const [importOpen, setImportOpen] = useState(false);
  const [catalog, setCatalog] = useState<RemoteMonsterRef[]>([]);
  const [query, setQuery] = useState("");
  const [remoteResults, setRemoteResults] = useState<FiveEToolsMonster[]>([]);
  const [selectedRemoteMonsters, setSelectedRemoteMonsters] = useState<
    FiveEToolsMonster[]
  >([]);
  const [remoteLoading, setRemoteLoading] = useState(false);
  const [remoteError, setRemoteError] = useState("");
  const [viewMode, setViewMode] = useState<"cards" | "list">("cards");
  const [selectedMonsterIds, setSelectedMonsterIds] = useState<string[]>([]);
  const [duplicatePrompt, setDuplicatePrompt] = useState<{
    existing: Monster;
    incoming: Monster;
  } | null>(null);
  const duplicateResolver = useRef<((replace: boolean) => void) | null>(null);
  const remoteFiles = useRef(new Map<string, FiveEToolsMonster[]>());
  const update = (id: string, part: Partial<Monster>) =>
    patch(
      "monsters",
      data.monsters.map((monster) =>
        monster.id === id ? { ...monster, ...part } : monster,
      ),
    );
  const add = () => {
    const name = window.prompt("Enter a name for the new monster:", "")?.trim();
    if (!name) return;
    patch("monsters", [
      ...data.monsters,
      {
        id: uid(),
        name,
        type: "Medium creature",
        cr: "1",
        ac: 12,
        hp: 20,
        speed: "30 ft.",
        stats: "STR 10  DEX 10  CON 10  INT 10  WIS 10  CHA 10",
        abilities: "Add actions and abilities here.",
        spells: "No spells",
        slots: [0, 0, 0, 0, 0],
      },
    ]);
  };
  function deleteMonsters(ids: string[]) {
    if (!ids.length) return;
    const names = data.monsters
      .filter((monster) => ids.includes(monster.id))
      .map((monster) => monster.name);
    const label =
      ids.length === 1
        ? `Delete "${names[0]}" from the Bestiary?`
        : `Delete ${ids.length} selected monsters from the Bestiary?`;
    if (
      !window.confirm(
        `${label}\n\nExisting combatants will remain, but their linked stat blocks will no longer be available.`,
      )
    )
      return;
    patch(
      "monsters",
      data.monsters.filter((monster) => !ids.includes(monster.id)),
    );
    setSelectedMonsterIds((current) =>
      current.filter((id) => !ids.includes(id)),
    );
    toast.success(
      ids.length === 1 ? "Monster deleted" : `${ids.length} monsters deleted`,
    );
  }
  function toggleMonsterSelection(id: string) {
    setSelectedMonsterIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  }
  async function loadCatalog() {
    if (catalog.length) return;
    setRemoteLoading(true);
    setRemoteError("");
    try {
      const [searchResponse, indexResponse] = await Promise.all([
        fetch(`${BESTIARY_BASE}/search/index.json`),
        fetch(`${BESTIARY_BASE}/data/bestiary/index.json`),
      ]);
      if (!searchResponse.ok || !indexResponse.ok) throw new Error();
      const search = (await searchResponse.json()) as {
        m?: { s?: Record<string, number> };
        x?: Array<{ c?: number; n?: string; s?: number }>;
      };
      const fileIndex = (await indexResponse.json()) as Record<string, string>;
      const sourceById = new Map(
        Object.entries(search.m?.s ?? {}).map(([source, id]) => [id, source]),
      );
      const refs = (search.x ?? [])
        .filter(
          (item) => item.c === 1 && item.n && sourceById.has(item.s ?? -1),
        )
        .map((item) => {
          const source = sourceById.get(item.s ?? -1)!;
          return { name: item.n!, source, file: fileIndex[source] };
        })
        .filter((item) => item.file);
      setCatalog(refs);
    } catch {
      setRemoteError("The external Bestiary catalogue could not be loaded.");
    } finally {
      setRemoteLoading(false);
    }
  }
  const searchRemote = useCallback(async () => {
    const term = query.trim().toLowerCase();
    if (term.length < 2) {
      setRemoteResults([]);
      setRemoteError("");
      return;
    }
    setRemoteLoading(true);
    setRemoteError("");
    try {
      const matches = catalog
        .filter((item) => item.name.toLowerCase().includes(term))
        .slice(0, 50);
      const files = [...new Set(matches.map((item) => item.file))];
      await Promise.all(
        files.map(async (file) => {
          if (remoteFiles.current.has(file)) return;
          const response = await fetch(
            `${BESTIARY_BASE}/data/bestiary/${file}`,
          );
          if (!response.ok) throw new Error();
          const payload = (await response.json()) as {
            monster?: FiveEToolsMonster[];
          };
          remoteFiles.current.set(file, payload.monster ?? []);
        }),
      );
      const found = matches
        .map((ref) =>
          remoteFiles.current
            .get(ref.file)
            ?.find(
              (monster) =>
                monster.name === ref.name && monster.source === ref.source,
            ),
        )
        .filter((monster): monster is FiveEToolsMonster => Boolean(monster));
      setRemoteResults(found);
    } catch {
      setRemoteError("The matching monster data could not be loaded.");
    } finally {
      setRemoteLoading(false);
    }
  }, [catalog, query]);
  useEffect(() => {
    if (!importOpen || !catalog.length) return;
    const timeout = setTimeout(() => void searchRemote(), 250);
    return () => clearTimeout(timeout);
  }, [importOpen, catalog, query, searchRemote]);
  function toggleRemoteMonster(remote: FiveEToolsMonster) {
    const key = `${remote.name}::${remote.source}`;
    setSelectedRemoteMonsters((current) =>
      current.some((item) => `${item.name}::${item.source}` === key)
        ? current.filter((item) => `${item.name}::${item.source}` !== key)
        : [...current, remote],
    );
  }
  function askAboutDuplicate(existing: Monster, incoming: Monster) {
    setDuplicatePrompt({ existing, incoming });
    return new Promise<boolean>((resolve) => {
      duplicateResolver.current = resolve;
    });
  }
  function resolveDuplicate(replace: boolean) {
    const resolve = duplicateResolver.current;
    duplicateResolver.current = null;
    setDuplicatePrompt(null);
    resolve?.(replace);
  }
  async function importSelectedMonsters() {
    if (!selectedRemoteMonsters.length) return;
    const next = [...data.monsters];
    let added = 0;
    let replaced = 0;
    let discarded = 0;
    for (const remote of selectedRemoteMonsters) {
      const incoming = convertRemoteMonster(remote, uid);
      const duplicateIndex = next.findIndex(
        (existing) => monsterIdentity(existing) === monsterIdentity(incoming),
      );
      if (duplicateIndex < 0) {
        next.push(incoming);
        added++;
        continue;
      }
      const existing = next[duplicateIndex];
      if (await askAboutDuplicate(existing, incoming)) {
        next[duplicateIndex] = { ...incoming, id: existing.id };
        replaced++;
      } else discarded++;
    }
    patch("monsters", next);
    setImportOpen(false);
    setQuery("");
    setRemoteResults([]);
    setSelectedRemoteMonsters([]);
    const changes = [
      added && `${added} added`,
      replaced && `${replaced} replaced`,
      discarded && `${discarded} discarded`,
    ]
      .filter(Boolean)
      .join(", ");
    toast.success(
      changes ? `Bestiary import complete: ${changes}` : "No monsters imported",
    );
  }
  return (
    <>
      <ScreenTitle
        eyebrow="Creature library"
        title="Bestiary"
        action={
          <div className="flex flex-wrap justify-end gap-2">
            <div className="flex rounded-md border border-white/10 bg-black/20 p-0.5">
              <Button
                size="sm"
                variant="ghost"
                className={
                  viewMode === "cards"
                    ? "bg-amber-300/15 text-amber-200 hover:bg-amber-300/20"
                    : "text-stone-400 hover:bg-white/5"
                }
                onClick={() => setViewMode("cards")}
              >
                Cards
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className={
                  viewMode === "list"
                    ? "bg-amber-300/15 text-amber-200 hover:bg-amber-300/20"
                    : "text-stone-400 hover:bg-white/5"
                }
                onClick={() => setViewMode("list")}
              >
                List
              </Button>
            </div>
            <Dialog
              open={importOpen}
              onOpenChange={(open) => {
                setImportOpen(open);
                if (open) void loadCatalog();
                else {
                  setQuery("");
                  setRemoteResults([]);
                  setSelectedRemoteMonsters([]);
                  setRemoteError("");
                }
              }}
            >
              <DialogTrigger className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-md bg-amber-300 px-3 py-2 text-sm font-medium whitespace-nowrap text-black transition-all hover:bg-amber-200 [&_svg]:size-4">
                <Download /> Import monster
              </DialogTrigger>
              <DialogContent className="max-h-[88vh] overflow-y-auto border-amber-300/20 bg-[#12161e] text-stone-100 sm:max-w-2xl">
                <DialogHeader>
                  <DialogTitle className="font-serif text-2xl text-amber-100">
                    Import monsters
                  </DialogTitle>
                </DialogHeader>
                <p className="text-sm text-stone-400">
                  Search the external 5eTools Bestiary. Results update while you
                  type, and selected monsters remain selected across searches.
                </p>
                <div className="relative">
                  <Input
                    autoFocus
                    aria-label="Search external bestiary"
                    placeholder="Type at least two characters…"
                    className="border-white/10 bg-black/20 pr-24"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-stone-500">
                    {remoteLoading
                      ? "Searching…"
                      : query.trim().length >= 2
                        ? `${remoteResults.length} results`
                        : "Typeahead"}
                  </span>
                </div>
                {remoteError && (
                  <p className="rounded-lg border border-red-400/20 bg-red-400/5 p-3 text-sm text-red-200">
                    {remoteError}
                  </p>
                )}
                {!remoteLoading && remoteResults.length > 0 && (
                  <>
                    <div className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/20 p-3">
                      <label className="flex items-center gap-2 text-sm text-stone-400">
                        <input
                          type="checkbox"
                          className="size-4 accent-amber-300"
                          checked={remoteResults.every((remote) =>
                            selectedRemoteMonsters.some(
                              (item) =>
                                item.name === remote.name &&
                                item.source === remote.source,
                            ),
                          )}
                          onChange={(e) =>
                            setSelectedRemoteMonsters((current) => {
                              const visibleKeys = new Set(
                                remoteResults.map(
                                  (remote) =>
                                    `${remote.name}::${remote.source}`,
                                ),
                              );
                              if (!e.target.checked)
                                return current.filter(
                                  (item) =>
                                    !visibleKeys.has(
                                      `${item.name}::${item.source}`,
                                    ),
                                );
                              const existing = new Set(
                                current.map(
                                  (item) => `${item.name}::${item.source}`,
                                ),
                              );
                              return [
                                ...current,
                                ...remoteResults.filter(
                                  (remote) =>
                                    !existing.has(
                                      `${remote.name}::${remote.source}`,
                                    ),
                                ),
                              ];
                            })
                          }
                        />{" "}
                        Select all visible
                      </label>
                      <span className="text-xs text-stone-500">
                        {selectedRemoteMonsters.length} selected
                      </span>
                    </div>
                    <Button
                      disabled={!selectedRemoteMonsters.length}
                      onClick={importSelectedMonsters}
                      className="w-full bg-amber-300 text-black hover:bg-amber-200"
                    >
                      <Download /> Import selected (
                      {selectedRemoteMonsters.length})
                    </Button>
                    <div className="space-y-2">
                      {remoteResults.map((remote, index) => {
                        const summary = getRemoteSummary(remote);
                        const checked = selectedRemoteMonsters.some(
                          (item) =>
                            item.name === remote.name &&
                            item.source === remote.source,
                        );
                        return (
                          <label
                            key={`${remote.name}-${remote.source}-${index}`}
                            className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition ${checked ? "border-amber-300/30 bg-amber-300/[.05]" : "border-white/10 bg-black/20 hover:border-white/20"}`}
                          >
                            <input
                              type="checkbox"
                              className="size-4 shrink-0 accent-amber-300"
                              checked={checked}
                              onChange={() => toggleRemoteMonster(remote)}
                            />
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-medium text-stone-200">
                                {remote.name}
                              </p>
                              <p className="mt-1 text-xs text-stone-500">
                                {remote.source} · CR {summary.cr} ·{" "}
                                {summary.type} · HP {summary.hp} · AC{" "}
                                {summary.ac}
                              </p>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </>
                )}
                {!remoteLoading && !remoteError && !remoteResults.length && (
                  <div className="rounded-lg border border-dashed border-white/10 p-6 text-center text-sm text-stone-500">
                    {query.trim().length < 2
                      ? "Start typing a monster name to search."
                      : "No matching monsters found."}
                  </div>
                )}
              </DialogContent>
            </Dialog>
            <Button
              onClick={add}
              className="bg-amber-300 text-black hover:bg-amber-200"
            >
              <Plus /> New monster
            </Button>
          </div>
        }
      />
      {viewMode === "cards" ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {data.monsters.map((m) => (
            <div
              key={m.id}
              className="rounded-xl border border-white/10 bg-[#12161e] p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="truncate font-serif text-2xl text-amber-100">
                    {m.name}
                  </h2>
                  <p className="mt-1 text-sm italic text-stone-500">
                    {m.type} · CR {m.cr}
                    {m.source ? ` · ${m.source}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <MonsterDialog
                    monster={m}
                    update={(part) => update(m.id, part)}
                    trigger={
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-white/10"
                      >
                        Open
                      </Button>
                    }
                  />
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    className="text-stone-600 hover:text-red-300"
                    onClick={() => deleteMonsters([m.id])}
                    aria-label={`Delete ${m.name}`}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </div>
              <div className="mt-5 grid grid-cols-3 gap-2 text-center">
                <Stat label="Armor" value={m.ac} />
                <Stat label="Hit points" value={m.hp} />
                <Stat label="Speed" value={m.speed} />
              </div>
              <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-stone-400">
                {m.abilities.split("\n")[0]}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-white/10 bg-[#12161e]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 p-3">
            <label className="flex items-center gap-2 text-sm text-stone-400">
              <input
                type="checkbox"
                className="size-4 accent-amber-300"
                checked={
                  data.monsters.length > 0 &&
                  selectedMonsterIds.length === data.monsters.length
                }
                onChange={(e) =>
                  setSelectedMonsterIds(
                    e.target.checked
                      ? data.monsters.map((monster) => monster.id)
                      : [],
                  )
                }
              />{" "}
              Select all
            </label>
            <Button
              size="sm"
              variant="outline"
              className="border-red-400/20 bg-red-400/5 text-red-200 hover:bg-red-400/10"
              disabled={!selectedMonsterIds.length}
              onClick={() => deleteMonsters(selectedMonsterIds)}
            >
              <Trash2 /> Delete selected ({selectedMonsterIds.length})
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-black/25 text-xs uppercase tracking-wider text-stone-500">
                <tr>
                  <th className="w-12 px-4 py-3">
                    <span className="sr-only">Select</span>
                  </th>
                  <th className="px-3 py-3">Monster</th>
                  <th className="px-3 py-3">Type</th>
                  <th className="px-3 py-3">CR</th>
                  <th className="px-3 py-3 text-right">AC</th>
                  <th className="px-3 py-3 text-right">HP</th>
                  <th className="px-3 py-3">Speed</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {data.monsters.map((m) => (
                  <tr
                    key={m.id}
                    className={
                      selectedMonsterIds.includes(m.id)
                        ? "bg-amber-300/[.05]"
                        : "hover:bg-white/[.025]"
                    }
                  >
                    <td className="px-4 py-2.5">
                      <input
                        type="checkbox"
                        className="size-4 accent-amber-300"
                        checked={selectedMonsterIds.includes(m.id)}
                        onChange={() => toggleMonsterSelection(m.id)}
                        aria-label={`Select ${m.name}`}
                      />
                    </td>
                    <td className="px-3 py-2.5">
                      <p className="font-medium text-amber-100">{m.name}</p>
                      {m.source && (
                        <p className="text-xs text-stone-600">{m.source}</p>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-stone-400">{m.type}</td>
                    <td className="px-3 py-2.5 text-stone-300">{m.cr}</td>
                    <td className="px-3 py-2.5 text-right text-stone-300">
                      {m.ac}
                    </td>
                    <td className="px-3 py-2.5 text-right text-stone-300">
                      {m.hp}
                    </td>
                    <td className="px-3 py-2.5 text-stone-400">{m.speed}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex justify-end gap-1">
                        <MonsterDialog
                          monster={m}
                          update={(part) => update(m.id, part)}
                          trigger={
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-white/10"
                            >
                              Open
                            </Button>
                          }
                        />
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          className="text-stone-600 hover:text-red-300"
                          onClick={() => deleteMonsters([m.id])}
                          aria-label={`Delete ${m.name}`}
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <Dialog
        open={Boolean(duplicatePrompt)}
        onOpenChange={(open) => {
          if (!open) resolveDuplicate(false);
        }}
      >
        <DialogContent className="border-amber-300/20 bg-[#12161e] text-stone-100">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl text-amber-100">
              Monster already exists
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm leading-relaxed text-stone-400">
            <span className="font-medium text-stone-200">
              {duplicatePrompt?.incoming.name}
            </span>
            {duplicatePrompt?.incoming.source
              ? ` (${duplicatePrompt.incoming.source})`
              : ""}{" "}
            already exists in the Bestiary. What would you like to do with this
            import?
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <Button
              variant="outline"
              className="border-white/15 bg-transparent hover:bg-white/5"
              onClick={() => resolveDuplicate(false)}
            >
              <X /> Discard import
            </Button>
            <Button
              className="bg-amber-300 text-black hover:bg-amber-200"
              onClick={() => resolveDuplicate(true)}
            >
              <Download /> Replace existing
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
