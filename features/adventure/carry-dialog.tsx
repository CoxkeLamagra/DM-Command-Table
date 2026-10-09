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
import { getCampaign, prepareNextSession } from "@/features/shared/api-client";
import type { Campaign, Session } from "@/domain/types";
import { emptyContinuity } from "@/domain/adventure";
export function CarryDialog({
  session,
  close,
  created,
}: {
  session: Session;
  close: () => void;
  created: (session: Session) => void;
}) {
  const [campaign, setCampaign] = useState<Campaign | null>(null),
    [title, setTitle] = useState(`${session.title} — Next`.slice(0, 200)),
    [date, setDate] = useState(""),
    [busy, setBusy] = useState(false);
  const continuity = session.continuity ?? emptyContinuity(),
    [scenes, setScenes] = useState<string[]>(
      continuity.scenes.filter((scene) => !scene.done).map((scene) => scene.id),
    ),
    [threads, setThreads] = useState<string[]>(continuity.threadIds);
  useEffect(() => {
    let live = true;
    void getCampaign(session.campaignId)
      .then((value) => {
        if (live) {
          setCampaign(value);
          setThreads(
            (session.continuity?.threadIds ?? []).filter((id) =>
              value.adventure?.threads.some(
                (thread) => thread.id === id && thread.status === "open",
              ),
            ),
          );
        }
      })
      .catch((error) => toast.error(error.message));
    return () => {
      live = false;
    };
  }, [session.campaignId, session.continuity?.threadIds]);
  async function submit() {
    if (!campaign) return;
    setBusy(true);
    try {
      const next = await prepareNextSession(session.campaignId, session.id, {
        revision: session.revision,
        campaignRevision: campaign.revision,
        title: title.trim(),
        date,
        sceneIds: scenes,
        threadIds: threads,
      });
      created(next);
      close();
      toast.success("Next session prepared");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not prepare next session",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(value) => {
        if (!value && !busy) close();
      }}
    >
      <DialogContent className="max-h-[85vh] overflow-y-auto border-white/10 bg-[#151820] text-stone-100">
        <DialogHeader>
          <DialogTitle>Prepare next session</DialogTitle>
          <DialogDescription>
            Copy selected unfinished scenes and open threads. The original
            session, recap and rewards stay unchanged. Attendance is copied as
            an editable starting point.
          </DialogDescription>
        </DialogHeader>
        <Input
          aria-label="Next session title"
          maxLength={200}
          value={title}
          disabled={busy}
          onChange={(event) => setTitle(event.target.value)}
        />
        <Input
          aria-label="Next session date"
          type="date"
          value={date}
          disabled={busy}
          onChange={(event) => setDate(event.target.value)}
        />
        <h3 className="font-medium">Unfinished scenes</h3>
        {continuity.scenes
          .filter((scene) => !scene.done)
          .map((scene) => (
            <label key={scene.id} className="flex gap-2 text-sm">
              <input
                type="checkbox"
                disabled={busy}
                checked={scenes.includes(scene.id)}
                onChange={(event) =>
                  setScenes(
                    event.target.checked
                      ? [...scenes, scene.id]
                      : scenes.filter((id) => id !== scene.id),
                  )
                }
              />
              {scene.title} · {scene.essential ? "Essential" : "Optional"}
            </label>
          ))}
        <h3 className="font-medium">Open threads</h3>
        {campaign?.adventure?.threads
          .filter((thread) => thread.status === "open")
          .map((thread) => (
            <label key={thread.id} className="flex gap-2 text-sm">
              <input
                type="checkbox"
                disabled={busy}
                checked={threads.includes(thread.id)}
                onChange={(event) =>
                  setThreads(
                    event.target.checked
                      ? [...threads, thread.id]
                      : threads.filter((id) => id !== thread.id),
                  )
                }
              />
              {thread.title}
            </label>
          ))}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" disabled={busy} onClick={close}>
            Cancel
          </Button>
          <Button
            disabled={!campaign || busy || !title.trim()}
            onClick={submit}
          >
            Create next session
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
