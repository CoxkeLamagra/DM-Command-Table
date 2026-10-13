"use client";

import { useMemo, useState } from "react";
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
  convertCatalogueMonster,
  getMonsterSummary,
  type FiveEToolsMonster,
} from "@/features/bestiary/fiveetools";
import {
  parseCatalogue,
  searchCatalogue,
  catalogueIdentity,
} from "./local-catalogue";
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
  const [localCatalogue, setLocalCatalogue] = useState<FiveEToolsMonster[]>([]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<FiveEToolsMonster[]>([]);
  const [importing, setImporting] = useState(false);
  const results = useMemo(
    () => searchCatalogue(query, localCatalogue),
    [query, localCatalogue],
  );
  const key = catalogueIdentity;
  async function run() {
    if (importing) return;
    setImporting(true);
    const next = [...monsters];
    let added = 0,
      replaced = 0,
      discarded = 0;
    for (const remote of selected) {
      const converted = convertCatalogueMonster(remote, () =>
        crypto.randomUUID(),
      );
      const input = {
        name: converted.name,
        type: converted.type,
        challengeRating: converted.cr,
        armorClass: converted.ac,
        hitPoints: converted.hp,
        speed: converted.speed,
        stats: converted.stats,
        abilities: converted.abilities,
        spells: converted.spells,
        notes: "",
        spellSlots: converted.slots,
        source: converted.source ?? null,
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
    setImporting(false);
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
                    setLocalCatalogue(parseCatalogue(await file.text()));
                    setSelected([]);
                    setQuery("");
                  } catch (error) {
                    toast.error(
                      error instanceof Error ? error.message : "Import failed",
                    );
                  }
                }}
              />
            </label>
            <p className="text-xs text-stone-400">
              Choose a local catalogue, then search and preview monsters before
              importing. Files are read in your browser; selected records are
              saved on this server.
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
              <Button onClick={run} disabled={!selected.length || importing}>
                <Download /> Import selected ({selected.length})
              </Button>
            </>
          )}
          <div className="space-y-1">
            {results.map((item) => {
              const summary = getMonsterSummary(item);
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
                    {item.source} · CR {summary.cr} · {summary.type} · AC{" "}
                    {summary.ac} · HP {summary.hp}
                  </span>
                </label>
              );
            })}
          </div>
          {importing && <p className="text-sm text-stone-500">Importing…</p>}
        </DialogContent>
      </Dialog>
    </>
  );
}
