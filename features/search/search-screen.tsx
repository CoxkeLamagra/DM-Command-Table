"use client";

import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { highlightParts } from "@/features/shared/search-highlight";
import { searchCampaign } from "../shared/api-client";
import type { SearchResult, Section } from "@/domain/types";

const resultTypes = {
  all: "All records",
  session: "Sessions",
  story: "Stories",
  player: "Players",
  npc: "NPCs",
  monster: "Bestiary",
};
const resultLabels: Record<string, string> = {
  session: "Session",
  story: "Story",
  player: "Player",
  npc: "NPC",
  monster: "Monster",
};

export function SearchScreen({
  campaignId,
  navigate,
}: {
  campaignId: string;
  navigate: (section: Section, id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">(
    "idle",
  );
  const [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    const timer = window.setTimeout(() => {
      if (!query.trim()) {
        setResults([]);
        setStatus("idle");
        return;
      }
      setStatus("loading");
      setResults([]);
      void searchCampaign(campaignId, query, type)
        .then((items) => {
          if (live) {
            setResults(items);
            setStatus("ready");
          }
        })
        .catch((reason: unknown) => {
          if (live) {
            setError(
              reason instanceof Error
                ? reason.message
                : "Search failed. Try again.",
            );
            setStatus("error");
          }
        });
    }, 200);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [campaignId, query, type]);
  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[.2em] text-amber-300">
          Campaign workspace
        </p>
        <h1 className="mt-1 font-serif text-3xl">Search</h1>
        <p className="mt-2 text-sm text-stone-400">
          Find a record and open it directly.
        </p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 size-4 text-stone-400" />
          <Input
            autoFocus
            aria-label="Search campaign records"
            className="h-11 pl-10"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setResults([]);
              setStatus(event.target.value.trim() ? "loading" : "idle");
            }}
            placeholder="Search sessions, stories, players, NPCs, and monsters…"
          />
        </div>
        <select
          aria-label="Filter search by record type"
          className="h-11 rounded-md border border-white/10 bg-[#191d27] px-3 text-sm"
          value={type}
          onChange={(event) => {
            setType(event.target.value);
            setResults([]);
            setStatus(query.trim() ? "loading" : "idle");
          }}
        >
          {Object.entries(resultTypes).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <p role="status" aria-live="polite" className="text-sm text-stone-400">
        {status === "loading"
          ? "Searching…"
          : status === "idle"
            ? "Enter a name or a few words from a record’s notes."
            : status === "error"
              ? error
              : !results.length
                ? "No matching records. Try fewer words or another type."
                : `${results.length} result${results.length === 1 ? "" : "s"}${results.length === 100 ? " (showing the first 100; refine your search for more)" : ""}`}
      </p>
      <div className="space-y-2">
        {results.map((result) => (
          <button
            key={`${result.resourceType}:${result.resourceId}`}
            aria-label={`Open ${resultLabels[result.resourceType] ?? "record"}: ${result.title}`}
            onClick={() =>
              navigate(resourceSection(result.resourceType), result.resourceId)
            }
            className="record-row block w-full rounded-xl border border-white/10 bg-[#13161d] p-4 text-left hover:border-amber-300/40 focus-visible:outline-amber-300"
          >
            <span className="text-xs uppercase tracking-wider text-stone-400">
              {resultLabels[result.resourceType] ?? result.resourceType}
            </span>
            <p className="mt-1 font-medium text-amber-100">
              <Highlight value={result.title} query={query} />
            </p>
            <p className="mt-1 text-sm text-stone-300">
              <Highlight
                value={result.excerpt.replace(/<[^>]+>/g, "")}
                query={query}
              />
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}
function Highlight({ value, query }: { value: string; query: string }) {
  return highlightParts(value, query).map((part, index) =>
    part.match ? (
      <mark key={index} className="rounded bg-amber-300/20 text-amber-200">
        {part.text}
      </mark>
    ) : (
      part.text
    ),
  );
}
function resourceSection(type: string): Section {
  if (type === "session") return "sessions";
  if (type === "story") return "story";
  if (type === "player" || type === "npc") return "players";
  return "bestiary";
}
