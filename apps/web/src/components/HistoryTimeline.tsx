import { History } from "lucide-react";
import type { Activity } from "../types";
import { formatDateTime } from "../utils/format";
import { EmptyState } from "./EmptyState";

export function HistoryTimeline({ activity }: { activity: Activity }) {
  if (!activity.history?.length) {
    return <EmptyState title="Sem histórico" description="As mudanças aparecerão aqui." />;
  }

  return (
    <div className="space-y-3">
      {activity.history.map((item) => (
        <div key={item.id} className="flex gap-3 rounded-lg border border-slate-100 bg-white p-3">
          <span className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-violet-50 text-brand">
            <History className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-bold text-ink">{item.action}</p>
            {item.fieldChanged ? (
              <p className="mt-1 text-xs text-muted">
                {item.fieldChanged}: {item.oldValue || "-"} → {item.newValue || "-"}
              </p>
            ) : null}
            <p className="mt-1 text-xs text-slate-400">
              {item.user.name} · {formatDateTime(item.createdAt)}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
