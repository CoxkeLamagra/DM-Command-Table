import type { ProgressStatus } from "./types";

export const progressLabels: Record<ProgressStatus, string> = {
  planned: "Planned",
  active: "In progress",
  happened: "Completed",
};

export function StatusBadge({ status }: { status: ProgressStatus }) {
  const color =
    status === "active"
      ? "bg-amber-400/15 text-amber-300"
      : status === "happened"
        ? "bg-emerald-400/15 text-emerald-300"
        : "bg-sky-400/15 text-sky-300";
  return (
    <span className={`rounded-full px-2 py-1 text-xs ${color}`}>
      {progressLabels[status]}
    </span>
  );
}

export function StatusSelect({
  value,
  onChange,
  disabled,
}: {
  value: ProgressStatus;
  onChange: (value: ProgressStatus) => void;
  disabled?: boolean;
}) {
  return (
    <select
      className="h-9 rounded-md border border-white/10 bg-[#191d27] px-3 text-sm"
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value as ProgressStatus)}
    >
      {Object.entries(progressLabels).map(([id, label]) => (
        <option key={id} value={id}>
          {label}
        </option>
      ))}
    </select>
  );
}
