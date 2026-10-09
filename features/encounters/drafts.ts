import { acceptSavedDraft } from "../shared/draft-state.ts";
export function reconcileSaved<T extends { id: string; revision: number }>(
  current: T,
  submitted: T,
  saved: T,
): T {
  return acceptSavedDraft(current, submitted, saved)!;
}
