import type { PreparedEncounter } from "@/domain/types";
import { acceptSavedDraft } from "../shared/draft-state.ts";
export function reconcileSaved<T extends { id: string; revision: number }>(
  current: T,
  submitted: T,
  saved: T,
): T {
  return acceptSavedDraft(current, submitted, saved)!;
}

export type EncounterDraftController = {
  snapshot: () => PreparedEncounter[];
  reconcile: (
    submitted: PreparedEncounter[],
    saved: PreparedEncounter[],
  ) => void;
};
