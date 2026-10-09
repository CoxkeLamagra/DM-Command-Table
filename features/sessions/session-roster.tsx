"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { Player } from "@/domain/types";
import { listPlayers } from "../shared/api-client";
import { RichTextContent } from "../rich-text/rich-text";
import { Input } from "@/components/ui/input";
export function SessionRoster({ campaignId }: { campaignId: string }) {
  const [records, setRecords] = useState<Player[]>([]);
  const [query, setQuery] = useState("");
  useEffect(() => {
    let live = true;
    void listPlayers(campaignId)
      .then((items) => {
        if (live) setRecords(items);
      })
      .catch(() => toast.error("Session roster could not be loaded."));
    return () => {
      live = false;
    };
  }, [campaignId]);
  const visible = records.filter((item) =>
    `${item.name} ${item.race} ${item.className}`
      .toLowerCase()
      .includes(query.toLowerCase().trim()),
  );
  return (
    <section
      aria-label="Session Players and NPCs"
      className="rounded-lg border border-white/10 p-4 lg:col-start-1 lg:row-start-3"
    >
      <h3 className="mb-3 font-medium">Players / NPCs — quick reference</h3>
      <Input
        aria-label="Search session roster"
        placeholder="Find a Player or NPC…"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <div className="mt-3 max-h-80 space-y-2 overflow-y-auto">
        {visible.map((item) => (
          <details key={item.id} className="rounded border border-white/10 p-3">
            <summary className="cursor-pointer">
              <span
                className={
                  item.kind === "npc" ? "text-blue-300" : "text-green-300"
                }
              >
                {item.name}
              </span>{" "}
              <span className="text-xs text-stone-400">
                {item.kind === "npc" ? "NPC" : "Player"} · AC{" "}
                {item.armorClass ?? "—"} · HP {item.hitPoints ?? "—"}
              </span>
            </summary>
            <p className="mt-2 text-sm text-stone-400">
              {[
                item.race,
                item.className,
                item.level ? `Level ${item.level}` : "",
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
            <RichTextContent value={item.notes} />
          </details>
        ))}
        {!visible.length && (
          <p className="text-sm text-stone-400">No matching roster records.</p>
        )}
      </div>
      <p className="mt-2 text-xs text-stone-400">
        Campaign reference values; current combat HP is tracked in Combat.
      </p>
    </section>
  );
}
