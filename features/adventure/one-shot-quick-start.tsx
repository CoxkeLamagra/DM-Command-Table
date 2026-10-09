"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { getCampaign, quickStartOneShot } from "@/features/shared/api-client";
import type { Campaign, Session } from "@/domain/types";
import type { PlannedScene } from "@/domain/adventure";
export function OneShotQuickStart({
  sourceId,
  close,
  created,
}: {
  sourceId?: string;
  close: () => void;
  created: (value: { campaign: Campaign; session: Session }) => void;
}) {
  const [source, setSource] = useState<Campaign | null>(null);
  const [name, setName] = useState("New one-shot");
  const [duration, setDuration] = useState("180");
  const [preset, setPreset] = useState("");
  const [busy, setBusy] = useState(false);
  const [scenes, setScenes] = useState<PlannedScene[]>(() =>
    ["Opening hook", "Central challenge", "Finale"].map((title, index) => ({
      id: crypto.randomUUID(),
      title,
      notes: "",
      essential: true,
      minutes: [30, 90, 60][index],
      done: false,
    })),
  );
  useEffect(() => {
    if (!sourceId) return;
    let live = true;
    void getCampaign(sourceId)
      .then((value) => {
        if (live) setSource(value);
      })
      .catch((error) => toast.error(error.message));
    return () => {
      live = false;
    };
  }, [sourceId]);
  function patch(id: string, part: Partial<PlannedScene>) {
    setScenes((all) =>
      all.map((value) => (value.id === id ? { ...value, ...part } : value)),
    );
  }
  async function submit() {
    setBusy(true);
    try {
      const value = await quickStartOneShot({
        name: name.trim(),
        durationMinutes: Number(duration),
        scenes,
        ...(preset && source
          ? {
              sourceCampaignId: source.id,
              sourceRevision: source.revision,
              presetId: preset,
            }
          : {}),
      });
      created(value);
      close();
      toast.success("One-shot created with one prepared session");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not create one-shot",
      );
    } finally {
      setBusy(false);
    }
  }
  const total = scenes.reduce((sum, scene) => sum + scene.minutes, 0);
  return (
    <Dialog
      open
      onOpenChange={(value) => {
        if (!value && !busy) close();
      }}
    >
      <DialogContent className="max-h-[85vh] overflow-y-auto border-white/10 bg-[#151820] text-stone-100 sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>One-shot quick start</DialogTitle>
          <DialogDescription>
            Create a campaign with one session, a scene checklist and optional
            copies of a saved party. Source campaigns and roster records remain
            unchanged. Existing campaign export/template actions can package it
            for reuse.
          </DialogDescription>
        </DialogHeader>
        <label className="text-sm">
          Name
          <Input
            aria-label="One-shot name"
            maxLength={120}
            value={name}
            disabled={busy}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <label className="text-sm">
          Duration (minutes)
          <Input
            aria-label="One-shot duration minutes"
            type="number"
            min={15}
            max={1440}
            value={duration}
            disabled={busy}
            onChange={(event) => setDuration(event.target.value)}
          />
        </label>
        <label className="text-sm">
          Party preset
          <select
            aria-label="One-shot party preset"
            className="ml-2 rounded border border-white/10 bg-[#191d27] p-2"
            value={preset}
            disabled={busy}
            onChange={(event) => setPreset(event.target.value)}
          >
            <option value="">Start without roster copies</option>
            {source?.adventure?.partyPresets.map((value) => (
              <option key={value.id} value={value.id}>
                {value.name} ({value.playerIds.length})
              </option>
            ))}
          </select>
        </label>
        <h3 className="font-medium">Scene checklist</h3>
        {scenes.map((scene) => (
          <div
            key={scene.id}
            className="space-y-2 rounded border border-white/10 p-3"
          >
            <Input
              aria-label="Quick-start scene title"
              maxLength={200}
              value={scene.title}
              disabled={busy}
              onChange={(event) =>
                patch(scene.id, { title: event.target.value })
              }
            />
            <div className="flex flex-wrap items-center gap-3">
              <label className="text-sm">
                <input
                  type="checkbox"
                  checked={scene.essential}
                  disabled={busy}
                  onChange={(event) =>
                    patch(scene.id, { essential: event.target.checked })
                  }
                />{" "}
                Essential
              </label>
              <Input
                aria-label={`${scene.title} estimate minutes`}
                className="w-24"
                type="number"
                min={0}
                max={1440}
                value={scene.minutes}
                disabled={busy}
                onChange={(event) =>
                  patch(scene.id, {
                    minutes: Math.max(
                      0,
                      Math.min(1440, Math.trunc(Number(event.target.value))),
                    ),
                  })
                }
              />
              <span className="text-xs">minutes</span>
              <Button
                variant="ghost"
                disabled={busy || scenes.length === 1}
                onClick={() =>
                  setScenes((all) =>
                    all.filter((value) => value.id !== scene.id),
                  )
                }
              >
                Remove {scene.title}
              </Button>
            </div>
          </div>
        ))}
        <Button
          variant="outline"
          disabled={busy || scenes.length >= 100}
          onClick={() =>
            setScenes((all) => [
              ...all,
              {
                id: crypto.randomUUID(),
                title: "Optional scene",
                notes: "",
                minutes: 15,
                essential: false,
                done: false,
              },
            ])
          }
        >
          Add optional scene
        </Button>
        <p
          className={`text-sm ${total > Number(duration) ? "text-amber-200" : "text-stone-400"}`}
        >
          {total} minutes planned / {duration || "0"} available. Trim optional
          scenes to keep pace.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" disabled={busy} onClick={close}>
            Cancel
          </Button>
          <Button
            disabled={
              busy ||
              !name.trim() ||
              !Number.isInteger(Number(duration)) ||
              Number(duration) < 15 ||
              Number(duration) > 1440 ||
              scenes.some((scene) => !scene.title.trim())
            }
            onClick={submit}
          >
            Create one-shot
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
