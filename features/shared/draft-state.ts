export function isDraftDirty<T>(
  draft: T | null,
  baseline: T | undefined,
): boolean {
  return draft !== null && JSON.stringify(draft) !== JSON.stringify(baseline);
}
export function acceptSavedDraft<T extends { id: string; revision: number }>(
  current: T | null,
  submitted: T,
  saved: T,
): T | null {
  if (!current || current.id !== submitted.id) return current;
  return current === submitted
    ? saved
    : { ...current, id: saved.id, revision: saved.revision };
}
