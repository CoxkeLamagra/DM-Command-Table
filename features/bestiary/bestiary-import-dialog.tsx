"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Download, X } from "lucide-react";
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
import { createId } from "@/features/campaign/id";
import type { Monster } from "@/features/campaign/types";
import {
  getRemoteSummary,
  type FiveEToolsMonster,
  type RemoteMonsterRef,
} from "./fiveetools";
import { applyMonsterImports } from "./import-service";
import { loadRemoteCatalogue, searchRemoteCatalogue } from "./remote-catalogue";

export function BestiaryImportDialog({
  monsters,
  replaceMonsters,
}: {
  monsters: Monster[];
  replaceMonsters: (monsters: Monster[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [catalog, setCatalog] = useState<RemoteMonsterRef[]>([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FiveEToolsMonster[]>([]);
  const [selected, setSelected] = useState<FiveEToolsMonster[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [duplicate, setDuplicate] = useState<{
    existing: Monster;
    incoming: Monster;
  } | null>(null);
  const duplicateResolver = useRef<((replace: boolean) => void) | null>(null);
  const remoteFiles = useRef(new Map<string, FiveEToolsMonster[]>());

  async function loadCatalog() {
    if (catalog.length) return;
    setLoading(true);
    setError("");
    try {
      setCatalog(await loadRemoteCatalogue());
    } catch {
      setError("The external Bestiary catalogue could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  const search = useCallback(async () => {
    const term = query.trim().toLowerCase();
    if (term.length < 2) {
      setResults([]);
      setError("");
      return;
    }
    setLoading(true);
    setError("");
    try {
      setResults(await searchRemoteCatalogue(term, catalog, remoteFiles.current));
    } catch {
      setError("The matching monster data could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [catalog, query]);

  useEffect(() => {
    if (!open || !catalog.length) return;
    const timeout = setTimeout(() => void search(), 250);
    return () => clearTimeout(timeout);
  }, [open, catalog, query, search]);

  function monsterKey(monster: FiveEToolsMonster) {
    return `${monster.name}::${monster.source}`;
  }

  function toggle(remote: FiveEToolsMonster) {
    const key = monsterKey(remote);
    setSelected((current) =>
      current.some((item) => monsterKey(item) === key)
        ? current.filter((item) => monsterKey(item) !== key)
        : [...current, remote],
    );
  }

  function askAboutDuplicate(existing: Monster, incoming: Monster) {
    setDuplicate({ existing, incoming });
    return new Promise<boolean>((resolve) => {
      duplicateResolver.current = resolve;
    });
  }

  function resolveDuplicate(replace: boolean) {
    const resolve = duplicateResolver.current;
    duplicateResolver.current = null;
    setDuplicate(null);
    resolve?.(replace);
  }

  async function importSelected() {
    if (!selected.length) return;
    const result = await applyMonsterImports(
      monsters,
      selected,
      createId,
      askAboutDuplicate,
    );
    replaceMonsters(result.monsters);
    reset();
    setOpen(false);
    const changes = [
      result.added && `${result.added} added`,
      result.replaced && `${result.replaced} replaced`,
      result.discarded && `${result.discarded} discarded`,
    ]
      .filter(Boolean)
      .join(", ");
    toast.success(changes ? `Bestiary import complete: ${changes}` : "No monsters imported");
  }

  function reset() {
    setQuery("");
    setResults([]);
    setSelected([]);
    setError("");
  }

  const visibleSelected =
    results.length > 0 &&
    results.every((remote) => selected.some((item) => monsterKey(item) === monsterKey(remote)));

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (next) void loadCatalog();
          else reset();
        }}
      >
        <DialogTrigger className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-md bg-amber-300 px-3 py-2 text-sm font-medium whitespace-nowrap text-black transition-all hover:bg-amber-200 [&_svg]:size-4">
          <Download /> Import monster
        </DialogTrigger>
        <DialogContent className="max-h-[88vh] overflow-y-auto border-amber-300/20 bg-[#12161e] text-stone-100 sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl text-amber-100">Import monsters</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-stone-400">
            Search the external 5eTools Bestiary. Results update while you type, and selected monsters remain selected across searches.
          </p>
          <div className="relative">
            <Input
              autoFocus
              aria-label="Search external bestiary"
              placeholder="Type at least two characters…"
              className="border-white/10 bg-black/20 pr-24"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-stone-500">
              {loading ? "Searching…" : query.trim().length >= 2 ? `${results.length} results` : "Typeahead"}
            </span>
          </div>
          {error && <p className="rounded-lg border border-red-400/20 bg-red-400/5 p-3 text-sm text-red-200">{error}</p>}
          {!loading && results.length > 0 && (
            <>
              <div className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/20 p-3">
                <label className="flex items-center gap-2 text-sm text-stone-400">
                  <input
                    type="checkbox"
                    className="size-4 accent-amber-300"
                    checked={visibleSelected}
                    onChange={(event) => {
                      const visibleKeys = new Set(results.map(monsterKey));
                      setSelected((current) => {
                        if (!event.target.checked)
                          return current.filter((item) => !visibleKeys.has(monsterKey(item)));
                        const existing = new Set(current.map(monsterKey));
                        return [...current, ...results.filter((item) => !existing.has(monsterKey(item)))];
                      });
                    }}
                  />
                  Select all visible
                </label>
                <span className="text-xs text-stone-500">{selected.length} selected</span>
              </div>
              <Button disabled={!selected.length} onClick={() => void importSelected()} className="w-full bg-amber-300 text-black hover:bg-amber-200">
                <Download /> Import selected ({selected.length})
              </Button>
              <div className="space-y-2">
                {results.map((remote, index) => {
                  const summary = getRemoteSummary(remote);
                  const checked = selected.some((item) => monsterKey(item) === monsterKey(remote));
                  return (
                    <label key={`${monsterKey(remote)}-${index}`} className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition ${checked ? "border-amber-300/30 bg-amber-300/[.05]" : "border-white/10 bg-black/20 hover:border-white/20"}`}>
                      <input type="checkbox" className="size-4 shrink-0 accent-amber-300" checked={checked} onChange={() => toggle(remote)} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-stone-200">{remote.name}</p>
                        <p className="mt-1 text-xs text-stone-500">{remote.source} · CR {summary.cr} · {summary.type} · HP {summary.hp} · AC {summary.ac}</p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </>
          )}
          {!loading && !error && !results.length && (
            <div className="rounded-lg border border-dashed border-white/10 p-6 text-center text-sm text-stone-500">
              {query.trim().length < 2 ? "Start typing a monster name to search." : "No matching monsters found."}
            </div>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={Boolean(duplicate)} onOpenChange={(next) => !next && resolveDuplicate(false)}>
        <DialogContent className="border-amber-300/20 bg-[#12161e] text-stone-100">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl text-amber-100">Monster already exists</DialogTitle>
          </DialogHeader>
          <p className="text-sm leading-relaxed text-stone-400">
            <span className="font-medium text-stone-200">{duplicate?.incoming.name}</span>
            {duplicate?.incoming.source ? ` (${duplicate.incoming.source})` : ""} already exists in the Bestiary. What would you like to do with this import?
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <Button variant="outline" className="border-white/15 bg-transparent hover:bg-white/5" onClick={() => resolveDuplicate(false)}>
              <X /> Discard import
            </Button>
            <Button className="bg-amber-300 text-black hover:bg-amber-200" onClick={() => resolveDuplicate(true)}>
              <Download /> Replace existing
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
