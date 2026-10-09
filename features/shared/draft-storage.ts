export const DRAFT_PREFIX = "dmct-draft-v1:";
export const DRAFT_LIFETIME = 7 * 24 * 60 * 60 * 1000;
export type RecoveryDraft<T> = { savedAt: number; value: T };
export type DraftStorage = Pick<
  Storage,
  "getItem" | "setItem" | "removeItem" | "key" | "length"
>;
export function draftKey(
  userId: string,
  campaignId: string,
  scope: string,
): string {
  return DRAFT_PREFIX + JSON.stringify([userId, campaignId, scope]);
}
export function readDraft<T>(
  storage: DraftStorage,
  key: string,
  now = Date.now(),
): RecoveryDraft<T> | null {
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const draft = JSON.parse(raw) as RecoveryDraft<T>;
    if (!draft || typeof draft !== "object") {
      storage.removeItem(key);
      return null;
    }
    if (
      !Number.isFinite(draft.savedAt) ||
      draft.savedAt > now ||
      now - draft.savedAt > DRAFT_LIFETIME ||
      !("value" in draft)
    ) {
      storage.removeItem(key);
      return null;
    }
    return draft;
  } catch {
    try {
      storage.removeItem(key);
    } catch {}
    return null;
  }
}
export function writeDraft<T>(
  storage: DraftStorage,
  key: string,
  value: T,
  now = Date.now(),
): void {
  storage.setItem(key, JSON.stringify({ savedAt: now, value }));
}
export function clearUserDrafts(storage: DraftStorage, userId: string): void {
  const keys = Array.from({ length: storage.length }, (_, index) =>
    storage.key(index),
  );
  for (const key of keys) {
    if (!key?.startsWith(DRAFT_PREFIX)) continue;
    try {
      if (JSON.parse(key.slice(DRAFT_PREFIX.length))[0] === userId)
        storage.removeItem(key);
    } catch {
      /* Ignore unrelated malformed keys. */
    }
  }
}

export function pruneDrafts(storage: DraftStorage, now = Date.now()): void {
  const keys = Array.from({ length: storage.length }, (_, index) =>
    storage.key(index),
  );
  for (const key of keys)
    if (key?.startsWith(DRAFT_PREFIX)) readDraft(storage, key, now);
}
