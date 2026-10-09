"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Download } from "lucide-react";
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
  convertRemoteMonster,
  getRemoteSummary,
  type FiveEToolsMonster,
  type RemoteMonsterRef,
} from "@/features/bestiary/fiveetools";
import {
  loadRemoteCatalogue,
  searchRemoteCatalogue,
} from "@/features/bestiary/remote-catalogue";
import { importMonster, updateMonster } from "../shared/api-client";
import type { Monster } from "@/domain/types";
export function BestiaryImport({
  campaignId,
  monsters,
  complete,
}: {
  campaignId: string;
  monsters: Monster[];
  complete: (items: Monster[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [remoteEnabled, setRemoteEnabled] = useState(false);
  const [localCatalogue, setLocalCatalogue] = useState<FiveEToolsMonster[]>([]);
  const searchGeneration = useRef(0);
  const [catalog, setCatalog] = useState<RemoteMonsterRef[]>([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FiveEToolsMonster[]>([]);
  const [selected, setSelected] = useState<FiveEToolsMonster[]>([]);
  const [loading, setLoading] = useState(false);
  const cache = useRef(new Map<string, FiveEToolsMonster[]>());
  useEffect(() => {
    if (!open || !remoteEnabled || catalog.length) return;
    const timer = setTimeout(() => {
      setLoading(true);
      void loadRemoteCatalogue()
        .then(setCatalog)
        .catch(() =>
          toast.error("The external Bestiary catalogue could not be loaded."),
        )
        .finally(() => setLoading(false));
    }, 0);
    return () => clearTimeout(timer);
  }, [open, remoteEnabled, catalog.length]);
  const search = useCallback(async () => {
    const generation = ++searchGeneration.current;
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const found = localCatalogue.length
        ? localCatalogue
            .filter((item) =>
              item.name.toLowerCase().includes(query.toLowerCase()),
            )
            .slice(0, 50)
        : await searchRemoteCatalogue(query.trim(), catalog, cache.current);
      if (generation === searchGeneration.current) setResults(found);
    } catch {
      toast.error("Monster search failed.");
    } finally {
      if (generation === searchGeneration.current) setLoading(false);
    }
  }, [catalog, query, localCatalogue]);
  useEffect(() => {
    if (!open || (!catalog.length && !localCatalogue.length)) return;
    const timer = setTimeout(() => void search(), 250);
    return () => clearTimeout(timer);
  }, [open, catalog.length, localCatalogue.length, search]);
  function key(item: FiveEToolsMonster) {
    return `${item.name}::${item.source}`.toLowerCase();
  }
  async function run() {
    const next = [...monsters];
    let added = 0,
      replaced = 0,
      discarded = 0;
    for (const remote of selected) {
      const legacy = convertRemoteMonster(remote, () => crypto.randomUUID());
      const input = {
        name: legacy.name,
        type: legacy.type,
        challengeRating: legacy.cr,
        armorClass: legacy.ac,
        hitPoints: legacy.hp,
        speed: legacy.speed,
        stats: legacy.stats,
        abilities: legacy.abilities,
        spells: legacy.spells,
        notes: "",
        spellSlots: legacy.slots,
        source: legacy.source ?? null,
        favorite: false,
      };
      const index = next.findIndex(
        (item) =>
          `${item.name}::${item.source ?? ""}`.toLowerCase() === key(remote),
      );
      try {
        if (index < 0) {
          next.push(await importMonster(campaignId, input));
          added++;
        } else if (
          window.confirm(
            `${remote.name} (${remote.source}) already exists. Replace the existing entry? Select Cancel to discard this import.`,
          )
        ) {
          const existing = next[index];
          next[index] = await updateMonster(campaignId, {
            ...existing,
            ...input,
            notes: existing.notes,
          });
          replaced++;
        } else discarded++;
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : `Could not import ${remote.name}`,
        );
      }
    }
    complete(next);
    setOpen(false);
    setSelected([]);
    setQuery("");
    toast.success(
      `Import complete: ${added} added, ${replaced} replaced, ${discarded} discarded`,
    );
  }
  const all =
    results.length > 0 &&
    results.every((item) => selected.some((entry) => key(entry) === key(item)));
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Download /> Import monsters
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[88vh] overflow-y-auto border-white/10 bg-[#151820] text-stone-100 sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Import monsters</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <label className="block text-sm">
              Import a local 5etools JSON file
              <Input
                type="file"
                accept="application/json,.json"
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  try {
                    if (file.size > 10 * 1024 * 1024)
                      throw new Error(
                        "Catalogue files must be no larger than 10 MB.",
                      );
                    const data = JSON.parse(await file.text());
                    if (
                      !Array.isArray(data.monster) ||
                      data.monster.some(
                        (item: FiveEToolsMonster) =>
                          typeof item.name !== "string" ||
                          typeof item.source !== "string",
                      )
                    )
                      throw new Error("Select a 5etools monster JSON file.");
                    setLocalCatalogue(data.monster);
                    setRemoteEnabled(false);
                    setCatalog([]);
                    setQuery("");
                    setResults([]);
                  } catch (error) {
                    toast.error(
                      error instanceof Error ? error.message : "Import failed",
                    );
                  }
                }}
              />
            </label>
            {!remoteEnabled && (
              <Button
                variant="outline"
                onClick={() => {
                  setRemoteEnabled(true);
                  setLocalCatalogue([]);
                }}
              >
                Connect to remote catalogue
              </Button>
            )}
            <p className="text-xs text-stone-400">
              Remote import connects to dnd5e.lamagra.link only after you choose
              it. Local files stay on this server.
            </p>
          </div>
          <Input
            autoFocus
            placeholder="Type at least two characters…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          {results.length > 0 && (
            <>
              <label className="flex items-center gap-2 rounded border border-white/10 p-3">
                <Checkbox
                  checked={all}
                  onCheckedChange={(checked) => {
                    const visible = new Set(results.map(key));
                    setSelected((current) =>
                      checked
                        ? [
                            ...current,
                            ...results.filter(
                              (item) =>
                                !current.some(
                                  (entry) => key(entry) === key(item),
                                ),
                            ),
                          ]
                        : current.filter((item) => !visible.has(key(item))),
                    );
                  }}
                />
                Select all visible{" "}
                <span className="ml-auto text-xs text-stone-500">
                  {selected.length} selected
                </span>
              </label>
              <Button onClick={run} disabled={!selected.length}>
                <Download /> Import selected ({selected.length})
              </Button>
            </>
          )}
          <div className="space-y-1">
            {results.map((item) => {
              const summary = getRemoteSummary(item);
              const checked = selected.some(
                (entry) => key(entry) === key(item),
              );
              return (
                <label
                  key={key(item)}
                  className="flex cursor-pointer items-center gap-3 rounded border border-white/10 p-3"
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={() =>
                      setSelected((current) =>
                        checked
                          ? current.filter((entry) => key(entry) !== key(item))
                          : [...current, item],
                      )
                    }
                  />
                  <span className="flex-1">{item.name}</span>
                  <span className="text-xs text-stone-500">
                    {item.source} · CR {summary.cr} · HP {summary.hp}
                  </span>
                </label>
              );
            })}
          </div>
          {loading && <p className="text-sm text-stone-500">Searching…</p>}
        </DialogContent>
      </Dialog>
    </>
  );
}
