"use client";
import { useEffect, useState } from "react";
import { getCampaign, listSessions } from "@/features/shared/api-client";
import type { PartyPreset } from "@/domain/adventure";
import type { Player, Session } from "@/domain/types";
import { toast } from "sonner";
export function PartyChoices({
  campaignId,
  attendanceIds,
  players,
  excluded = new Set<string>(),
  choose,
}: {
  campaignId?: string;
  attendanceIds?: string[];
  players: Player[];
  excluded?: Set<string>;
  choose: (ids: string[]) => void;
}) {
  const [presets, setPresets] = useState<PartyPreset[]>([]),
    [sessions, setSessions] = useState<Session[]>([]);
  useEffect(() => {
    if (!campaignId) return;
    let live = true;
    void Promise.all([getCampaign(campaignId), listSessions(campaignId)])
      .then(([campaign, items]) => {
        if (live) {
          setPresets(campaign.adventure?.partyPresets ?? []);
          setSessions(
            items.filter((item) => item.continuity?.attendanceIds.length),
          );
        }
      })
      .catch((error) => toast.error(error.message));
    return () => {
      live = false;
    };
  }, [campaignId]);
  if (!campaignId) return null;
  return (
    <label className="block text-sm">
      Select party
      <select
        aria-label="Select party"
        defaultValue=""
        className="ml-2 max-w-full rounded border border-white/10 bg-[#191d27] p-2"
        onChange={(event) => {
          const selected = event.target.value;
          let ids: string[] = [];
          if (selected === "current") ids = attendanceIds ?? [];
          else if (selected.startsWith("preset:"))
            ids =
              presets.find((preset) => preset.id === selected.slice(7))
                ?.playerIds ?? [];
          else
            ids =
              sessions.find((session) => session.id === selected.slice(8))
                ?.continuity?.attendanceIds ?? [];
          const valid = ids.filter(
            (id) =>
              players.some((player) => player.id === id) && !excluded.has(id),
          );
          choose(valid);
          if (valid.length < ids.length)
            toast.info(
              "Removed or already-present roster records were skipped.",
            );
          event.target.value = "";
        }}
      >
        <option value="">Choose attendance or preset…</option>
        {attendanceIds && (
          <option value="current">
            Current session party ({attendanceIds.length})
          </option>
        )}
        {presets.map((preset) => (
          <option key={preset.id} value={`preset:${preset.id}`}>
            {preset.name} ({preset.playerIds.length})
          </option>
        ))}
        {sessions.map((session) => (
          <option key={session.id} value={`session:${session.id}`}>
            {session.title} attendance (
            {session.continuity?.attendanceIds.length})
          </option>
        ))}
      </select>
      <span className="mt-1 block text-xs text-stone-400">
        Replaces the current selection with available records from this party.
      </span>
    </label>
  );
}
