"use client";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  draftKey,
  pruneDrafts,
  readDraft,
  writeDraft,
  type RecoveryDraft,
} from "./draft-storage";
export const DraftAccount = createContext<string | null>(null);
export function useDraftRecovery<T>({
  campaignId,
  scope,
  value,
  dirty,
  ready,
  restore,
}: {
  campaignId: string;
  scope: string;
  value: T;
  dirty: boolean;
  ready: boolean;
  restore: (value: T) => void;
}) {
  const userId = useContext(DraftAccount);
  const key = userId ? draftKey(userId, campaignId, scope) : null;
  const [candidate, setCandidate] = useState<RecoveryDraft<T> | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const warned = useRef(false);
  useEffect(() => {
    if (!ready || !key) return;
    const timer = window.setTimeout(() => {
      try {
        pruneDrafts(localStorage);
        setCandidate(readDraft<T>(localStorage, key));
      } catch {
        toast.error(
          "Browser draft storage is unavailable. Save changes to the server.",
        );
      }
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [key, ready]);
  useEffect(() => {
    if (!ready || !key || !hydrated || candidate) return;
    try {
      if (dirty) writeDraft(localStorage, key, value);
      else localStorage.removeItem(key);
    } catch {
      if (!warned.current) {
        toast.error(
          "Browser draft recovery is unavailable or storage is full. Save your changes to the server.",
        );
        warned.current = true;
      }
    }
  }, [key, ready, hydrated, candidate, dirty, value]);
  function discard() {
    if (key) {
      try {
        localStorage.removeItem(key);
      } catch {
        /* Storage disabled. */
      }
    }
    setCandidate(null);
  }
  const banner = candidate ? (
    <aside
      role="status"
      className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-amber-300/30 bg-amber-300/10 p-3 text-sm"
    >
      <div className="flex-1">
        <p className="font-medium">
          Unsaved {scope.startsWith("prepared:") ? "encounter" : scope} draft
          available
        </p>
        <p className="text-stone-300">
          From {new Date(candidate.savedAt).toLocaleString()}. Recovery keeps
          the original revisions; newer server changes will require
          reconciliation. Restore, download or discard this draft before
          continuing edits; new edits are not recovered while this choice is
          pending.
        </p>
      </div>
      <Button
        variant="outline"
        onClick={() => {
          try {
            restore(candidate.value);
            setCandidate(null);
          } catch {
            toast.error(
              "This draft cannot be restored. Download it to recover the text manually.",
            );
          }
        }}
      >
        Restore draft
      </Button>
      <Button
        variant="outline"
        onClick={() => {
          const url = URL.createObjectURL(
            new Blob([JSON.stringify(candidate.value, null, 2)], {
              type: "application/json",
            }),
          );
          const link = document.createElement("a");
          link.href = url;
          link.download = "dmct-recovered-draft.json";
          link.click();
          URL.revokeObjectURL(url);
        }}
      >
        Download draft
      </Button>
      <Button variant="ghost" onClick={discard}>
        Discard draft
      </Button>
    </aside>
  ) : null;
  return { banner, clear: discard };
}
