"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  RichTextEditor,
  RichTextContent,
} from "@/features/rich-text/rich-text";
import { uploadScreenshot } from "@/features/shared/api-client";
import { PartyChoices } from "./party-choices";
import type { Campaign, Player } from "@/domain/types";
import type { PlannedScene, SessionContinuity } from "@/domain/adventure";
export function SessionContinuityEditor({
  campaign,
  players,
  value,
  editable,
  update,
}: {
  campaign: Campaign | null;
  players: Player[];
  value: SessionContinuity;
  editable: boolean;
  update: (value: SessionContinuity) => void;
}) {
  const [title, setTitle] = useState("");
  function scene(id: string, part: Partial<PlannedScene>) {
    update({
      ...value,
      scenes: value.scenes.map((item) =>
        item.id === id ? { ...item, ...part } : item,
      ),
    });
  }
  const total = value.scenes.reduce((sum, item) => sum + item.minutes, 0),
    essential = value.scenes
      .filter((item) => item.essential)
      .reduce((sum, item) => sum + item.minutes, 0),
    limit = campaign?.adventure?.oneShot?.durationMinutes;
  return (
    <div className="mt-5 space-y-5 border-t border-white/10 pt-4">
      <section aria-label="Scene checklist" className="space-y-3">
        <h3 className="font-medium">Planned scenes</h3>
        <p className="text-sm text-stone-400">
          {total} minutes planned · {essential} essential
          {limit ? ` · ${limit} minute one-shot` : ""}. Optional scenes can be
          skipped to keep pace.
        </p>
        {limit && total > limit && (
          <p role="status" className="text-sm text-amber-200">
            Planned scenes exceed the available time. Trim optional scenes or
            adjust estimates.
          </p>
        )}
        {value.scenes.map((item) => (
          <details key={item.id} className="rounded border border-white/10 p-3">
            <summary className="cursor-pointer text-sm">
              {item.done ? "✓ " : ""}
              {item.title} · {item.essential ? "Essential" : "Optional"} ·{" "}
              {item.minutes} min
            </summary>
            <div className="mt-3 space-y-2">
              <Input
                aria-label="Scene title"
                value={item.title}
                maxLength={200}
                disabled={!editable}
                onChange={(event) =>
                  scene(item.id, { title: event.target.value })
                }
              />
              <div className="flex flex-wrap items-center gap-3">
                <label className="text-sm">
                  <input
                    type="checkbox"
                    checked={item.done}
                    disabled={!editable}
                    onChange={(event) =>
                      scene(item.id, { done: event.target.checked })
                    }
                  />{" "}
                  Completed scene
                </label>
                <label className="text-sm">
                  <input
                    type="checkbox"
                    checked={item.essential}
                    disabled={!editable}
                    onChange={(event) =>
                      scene(item.id, { essential: event.target.checked })
                    }
                  />{" "}
                  Essential scene
                </label>
                <label className="text-xs">
                  Minutes
                  <Input
                    aria-label={`${item.title} minutes`}
                    type="number"
                    min={0}
                    max={1440}
                    className="w-24"
                    value={item.minutes}
                    disabled={!editable}
                    onChange={(event) =>
                      scene(item.id, {
                        minutes: Math.max(
                          0,
                          Math.min(
                            1440,
                            Math.trunc(Number(event.target.value)),
                          ),
                        ),
                      })
                    }
                  />
                </label>
              </div>
              {editable ? (
                <RichTextEditor
                  value={item.notes}
                  onChange={(notes) => scene(item.id, { notes })}
                  onPasteImage={uploadScreenshot}
                  placeholder="Scene preparation…"
                  className="min-h-24"
                />
              ) : (
                <RichTextContent value={item.notes} />
              )}
              {editable && (
                <Button
                  variant="ghost"
                  onClick={() =>
                    update({
                      ...value,
                      scenes: value.scenes.filter(
                        (scene) => scene.id !== item.id,
                      ),
                    })
                  }
                >
                  Remove scene {item.title}
                </Button>
              )}
            </div>
          </details>
        ))}
        {editable && (
          <div className="flex gap-2">
            <Input
              aria-label="New scene title"
              maxLength={200}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Next planned scene…"
            />
            <Button
              variant="outline"
              disabled={!title.trim() || value.scenes.length >= 100}
              onClick={() => {
                update({
                  ...value,
                  scenes: [
                    ...value.scenes,
                    {
                      id: crypto.randomUUID(),
                      title: title.trim(),
                      notes: "",
                      essential: true,
                      minutes: 30,
                      done: false,
                    },
                  ],
                });
                setTitle("");
              }}
            >
              Add scene
            </Button>
          </div>
        )}
      </section>
      <section aria-label="Session recap">
        <h3 className="mb-2 font-medium">Recap — what actually happened</h3>
        {editable ? (
          <RichTextEditor
            value={value.recap}
            onChange={(recap) => update({ ...value, recap })}
            onPasteImage={uploadScreenshot}
            placeholder="Actual events and decisions…"
            className="min-h-32"
          />
        ) : (
          <RichTextContent value={value.recap} />
        )}
      </section>
      <section aria-label="Session rewards">
        <h3 className="mb-2 font-medium">Rewards</h3>
        {editable ? (
          <RichTextEditor
            value={value.rewards}
            onChange={(rewards) => update({ ...value, rewards })}
            onPasteImage={uploadScreenshot}
            placeholder="Treasure, XP, milestones and other rewards…"
            className="min-h-24"
          />
        ) : (
          <RichTextContent value={value.rewards} />
        )}
      </section>
      <section aria-label="Session threads">
        <h3 className="mb-2 font-medium">Campaign threads for this session</h3>
        {!campaign?.adventure?.threads.length && (
          <p className="text-sm text-stone-400">
            Create threads on the Campaign screen.
          </p>
        )}
        {campaign?.adventure?.threads
          .filter(
            (thread) =>
              thread.status === "open" || value.threadIds.includes(thread.id),
          )
          .map((thread) => (
            <label key={thread.id} className="mb-2 flex gap-2 text-sm">
              <input
                type="checkbox"
                checked={value.threadIds.includes(thread.id)}
                disabled={!editable}
                onChange={(event) =>
                  update({
                    ...value,
                    threadIds: event.target.checked
                      ? [...value.threadIds, thread.id]
                      : value.threadIds.filter((id) => id !== thread.id),
                  })
                }
              />
              {thread.title} · {thread.kind} · {thread.status}
            </label>
          ))}
      </section>
      <section aria-label="Session attendance">
        <h3 className="mb-2 font-medium">Tonight’s party / attendance</h3>
        {editable && (
          <PartyChoices
            campaignId={campaign?.id}
            players={players}
            choose={(attendanceIds) => update({ ...value, attendanceIds })}
          />
        )}
        <div className="mt-3 max-h-64 space-y-2 overflow-y-auto">
          {players.map((player) => (
            <label key={player.id} className="flex gap-2 text-sm">
              <input
                type="checkbox"
                checked={value.attendanceIds.includes(player.id)}
                disabled={!editable}
                onChange={(event) =>
                  update({
                    ...value,
                    attendanceIds: event.target.checked
                      ? [...value.attendanceIds, player.id]
                      : value.attendanceIds.filter((id) => id !== player.id),
                  })
                }
              />
              {player.name} · {player.kind}
            </label>
          ))}
        </div>
      </section>
    </div>
  );
}
