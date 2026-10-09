"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  RichTextEditor,
  RichTextContent,
} from "@/features/rich-text/rich-text";
import { listPlayers, uploadScreenshot } from "@/features/shared/api-client";
import { toast } from "sonner";
import type { CampaignAdventure, AdventureThread } from "@/domain/adventure";
import type { Player } from "@/domain/types";
const selectClass = "rounded border border-white/10 bg-[#191d27] p-2 text-sm";
export function CampaignAdventureEditor({
  campaignId,
  value,
  editable,
  update,
}: {
  campaignId: string;
  value: CampaignAdventure;
  editable: boolean;
  update: (value: CampaignAdventure) => void;
}) {
  const [players, setPlayers] = useState<Player[]>([]),
    [threadTitle, setThreadTitle] = useState(""),
    [presetName, setPresetName] = useState("");
  useEffect(() => {
    let live = true;
    void listPlayers(campaignId)
      .then((values) => {
        if (live) setPlayers(values);
      })
      .catch((error) => toast.error(error.message));
    return () => {
      live = false;
    };
  }, [campaignId]);
  function thread(id: string, part: Partial<AdventureThread>) {
    update({
      ...value,
      threads: value.threads.map((item) =>
        item.id === id ? { ...item, ...part } : item,
      ),
    });
  }
  return (
    <section
      aria-label="Adventure continuity"
      className="mt-6 space-y-4 rounded-xl border border-white/10 bg-[#13161d] p-5"
    >
      <h2 className="font-serif text-xl text-amber-200">
        Adventure continuity
      </h2>
      <p className="text-sm text-stone-400">
        Track promises, clues, consequences and objectives. Changes save with
        Campaign Save.
      </p>
      {value.oneShot && (
        <label className="block text-sm">
          One-shot duration (minutes)
          <Input
            aria-label="One-shot duration"
            className="mt-1 w-28"
            type="number"
            min={15}
            max={1440}
            value={value.oneShot.durationMinutes}
            disabled={!editable}
            onChange={(event) =>
              update({
                ...value,
                oneShot: {
                  durationMinutes: Math.max(
                    15,
                    Math.min(1440, Math.trunc(Number(event.target.value))),
                  ),
                },
              })
            }
          />
        </label>
      )}
      <h3 className="font-medium">
        Threads ({value.threads.filter((item) => item.status === "open").length}{" "}
        open)
      </h3>
      {value.threads.map((item) => (
        <details key={item.id} className="rounded border border-white/10 p-3">
          <summary className="cursor-pointer text-sm">
            {item.title} · {item.kind} · {item.status}
          </summary>
          <div className="mt-3 space-y-2">
            <Input
              aria-label="Thread title"
              maxLength={200}
              value={item.title}
              disabled={!editable}
              onChange={(event) =>
                thread(item.id, { title: event.target.value })
              }
            />
            <div className="flex flex-wrap gap-2">
              <select
                aria-label={`${item.title} type`}
                className={selectClass}
                value={item.kind}
                disabled={!editable}
                onChange={(event) =>
                  thread(item.id, {
                    kind: event.target.value as AdventureThread["kind"],
                  })
                }
              >
                {["promise", "clue", "consequence", "objective"].map((kind) => (
                  <option key={kind} value={kind}>
                    {kind}
                  </option>
                ))}
              </select>
              <select
                aria-label={`${item.title} status`}
                className={selectClass}
                value={item.status}
                disabled={!editable}
                onChange={(event) =>
                  thread(item.id, {
                    status: event.target.value as AdventureThread["status"],
                  })
                }
              >
                <option value="open">Open</option>
                <option value="resolved">Resolved</option>
              </select>
            </div>
            {editable ? (
              <RichTextEditor
                value={item.notes}
                onChange={(notes) => thread(item.id, { notes })}
                onPasteImage={uploadScreenshot}
                placeholder="Thread notes…"
                className="min-h-24"
              />
            ) : (
              <RichTextContent value={item.notes} />
            )}
          </div>
        </details>
      ))}
      {!value.threads.length && (
        <p className="text-sm text-stone-400">No campaign threads yet.</p>
      )}
      {editable && (
        <div className="flex gap-2">
          <Input
            aria-label="New thread title"
            maxLength={200}
            value={threadTitle}
            onChange={(event) => setThreadTitle(event.target.value)}
            placeholder="Unanswered clue, promise or objective…"
          />
          <Button
            variant="outline"
            disabled={!threadTitle.trim() || value.threads.length >= 500}
            onClick={() => {
              update({
                ...value,
                threads: [
                  ...value.threads,
                  {
                    id: crypto.randomUUID(),
                    title: threadTitle.trim(),
                    kind: "objective",
                    status: "open",
                    notes: "",
                  },
                ],
              });
              setThreadTitle("");
            }}
          >
            Add thread
          </Button>
        </div>
      )}
      <h3 className="border-t border-white/10 pt-4 font-medium">
        Party presets
      </h3>
      <p className="text-sm text-stone-400">
        Save common groups, including companion NPCs. Sessions record who
        actually attends.
      </p>
      {value.partyPresets.map((preset) => (
        <details key={preset.id} className="rounded border border-white/10 p-3">
          <summary className="cursor-pointer text-sm">
            {preset.name} (
            {
              preset.playerIds.filter((id) =>
                players.some((player) => player.id === id),
              ).length
            }
            )
          </summary>
          <Input
            aria-label="Party preset name"
            className="mt-3"
            maxLength={120}
            value={preset.name}
            disabled={!editable}
            onChange={(event) =>
              update({
                ...value,
                partyPresets: value.partyPresets.map((item) =>
                  item.id === preset.id
                    ? { ...item, name: event.target.value }
                    : item,
                ),
              })
            }
          />
          <div className="mt-3 max-h-64 space-y-2 overflow-y-auto">
            {players.map((player) => (
              <label key={player.id} className="flex gap-2 text-sm">
                <input
                  type="checkbox"
                  disabled={!editable}
                  checked={preset.playerIds.includes(player.id)}
                  onChange={(event) =>
                    update({
                      ...value,
                      partyPresets: value.partyPresets.map((item) =>
                        item.id === preset.id
                          ? {
                              ...item,
                              playerIds: event.target.checked
                                ? [...item.playerIds, player.id]
                                : item.playerIds.filter(
                                    (id) => id !== player.id,
                                  ),
                            }
                          : item,
                      ),
                    })
                  }
                />
                {player.name} · {player.kind}
              </label>
            ))}
          </div>
          {editable && (
            <Button
              variant="ghost"
              className="mt-2"
              onClick={() =>
                update({
                  ...value,
                  partyPresets: value.partyPresets.filter(
                    (item) => item.id !== preset.id,
                  ),
                })
              }
            >
              Remove preset {preset.name}
            </Button>
          )}
        </details>
      ))}
      {editable && (
        <div className="flex gap-2">
          <Input
            aria-label="New party preset name"
            maxLength={120}
            value={presetName}
            onChange={(event) => setPresetName(event.target.value)}
            placeholder="Tonight’s regular party…"
          />
          <Button
            variant="outline"
            disabled={!presetName.trim() || value.partyPresets.length >= 50}
            onClick={() => {
              update({
                ...value,
                partyPresets: [
                  ...value.partyPresets,
                  {
                    id: crypto.randomUUID(),
                    name: presetName.trim(),
                    playerIds: players
                      .filter((player) => player.kind === "player")
                      .map((player) => player.id),
                  },
                ],
              });
              setPresetName("");
            }}
          >
            Add party preset
          </Button>
        </div>
      )}
    </section>
  );
}
