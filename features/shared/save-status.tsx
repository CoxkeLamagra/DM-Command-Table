"use client";

export function SaveStatus({
  dirty,
  saving,
  label = "Changes",
}: {
  dirty: boolean;
  saving: boolean;
  label?: string;
}) {
  const text = saving ? "Saving…" : dirty ? "Unsaved changes" : "Saved";
  return (
    <span
      role="status"
      aria-live="polite"
      aria-label={`${label}: ${text}`}
      className={`shrink-0 text-xs ${saving ? "text-sky-300" : dirty ? "text-amber-300" : "text-emerald-300"}`}
    >
      {text}
    </span>
  );
}
