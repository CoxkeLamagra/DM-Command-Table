export function reconcileSaved<T extends { id: string; revision: number }>(
  current: T,
  submitted: T,
  saved: T,
): T {
  return current === submitted
    ? saved
    : { ...current, revision: saved.revision };
}
