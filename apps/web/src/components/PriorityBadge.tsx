import clsx from "clsx";
import { Flame, SignalHigh, SignalLow, SignalMedium } from "lucide-react";
import type { Priority } from "../types";
import { PRIORITY_LABELS } from "../types";

const priorityStyles: Record<Priority, string> = {
  LOW: "bg-emerald-50 text-emerald-700",
  MEDIUM: "bg-slate-100 text-slate-700",
  HIGH: "bg-red-50 text-red-700",
  CRITICAL: "bg-rose-100 text-rose-800"
};

const icons = {
  LOW: SignalLow,
  MEDIUM: SignalMedium,
  HIGH: SignalHigh,
  CRITICAL: Flame
};

export function PriorityBadge({ priority, compact = false }: { priority: Priority; compact?: boolean }) {
  const Icon = icons[priority];

  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-md px-2 py-1 font-semibold",
        compact ? "text-[11px]" : "text-xs",
        priorityStyles[priority]
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {PRIORITY_LABELS[priority]}
    </span>
  );
}
