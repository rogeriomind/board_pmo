import clsx from "clsx";
import type { ActivityStatus } from "../types";
import { STATUS_LABELS } from "../types";

const statusStyles: Record<ActivityStatus, string> = {
  BACKLOG: "bg-slate-100 text-slate-700",
  TODO: "bg-violet-100 text-violet-700",
  IN_PROGRESS: "bg-blue-100 text-blue-700",
  BLOCKED: "bg-red-100 text-red-700",
  IN_REVIEW: "bg-amber-100 text-amber-700",
  DONE: "bg-emerald-100 text-emerald-700",
  CANCELED: "bg-zinc-100 text-zinc-600"
};

export function StatusBadge({ status, compact = false }: { status: ActivityStatus; compact?: boolean }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-md px-2 py-1 font-semibold",
        compact ? "text-[11px]" : "text-xs",
        statusStyles[status]
      )}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
