import type { Session } from "../../domain/types.ts";

// Continue an active session first; otherwise choose the earliest planned date.
// Undated sessions follow dated ones, with stable ordering by sortOrder and ID.
export function nextSession(sessions: Session[]): Session | undefined {
  return sessions
    .filter(({ status }) => status !== "happened")
    .sort(
      (a, b) =>
        Number(b.status === "active") - Number(a.status === "active") ||
        (a.date || "9999").localeCompare(b.date || "9999") ||
        a.sortOrder - b.sortOrder ||
        a.id.localeCompare(b.id),
    )[0];
}
