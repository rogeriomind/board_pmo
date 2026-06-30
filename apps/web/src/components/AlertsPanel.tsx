import clsx from "clsx";
import { AlertCircle, AlertTriangle, Bell, Clock3, ShieldAlert, UserX } from "lucide-react";
import { useMemo, useState } from "react";
import { useAlerts } from "../hooks/useAlerts";
import type { Activity } from "../types";
import { formatDate } from "../utils/format";
import { EmptyState } from "./EmptyState";
import { LoadingSkeleton } from "./LoadingSkeleton";
import { PriorityBadge } from "./PriorityBadge";
import { StatusBadge } from "./StatusBadge";

type AlertTab = "all" | "overdue" | "atRisk" | "blocked" | "withoutAssignee" | "nearDueDate";

const tabConfig: Array<{ key: AlertTab; label: string; icon: typeof Bell }> = [
  { key: "all", label: "Todos", icon: Bell },
  { key: "overdue", label: "Atrasos", icon: AlertTriangle },
  { key: "atRisk", label: "Risco", icon: Clock3 },
  { key: "blocked", label: "Bloqueios", icon: ShieldAlert },
  { key: "withoutAssignee", label: "Sem resp.", icon: UserX },
  { key: "nearDueDate", label: "Próximas", icon: AlertCircle }
];

export function AlertsPanel({ onOpenActivity }: { onOpenActivity: (activityId: string) => void }) {
  const { data, isLoading, isError, error } = useAlerts();
  const [activeTab, setActiveTab] = useState<AlertTab>("all");

  const allAlerts = useMemo(() => {
    if (!data) return [];
    const map = new Map<string, Activity>();
    [...data.overdue, ...data.atRisk, ...data.blocked, ...data.withoutAssignee, ...data.nearDueDate].forEach(
      (activity) => map.set(activity.id, activity)
    );
    return [...map.values()];
  }, [data]);

  const visible = activeTab === "all" ? allAlerts : data?.[activeTab] ?? [];

  if (isLoading) return <LoadingSkeleton lines={4} />;

  if (isError) {
    return <EmptyState title="Não foi possível carregar alertas" description={error.message} />;
  }

  return (
    <section className="mx-auto max-w-5xl">
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-card">
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-md bg-violet-50 text-brand">
            <Bell className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-lg font-bold text-ink">Alertas</h2>
            <p className="text-sm text-muted">Acompanhe atrasos, bloqueios e prioridades do board.</p>
          </div>
        </div>

        <div className="scrollbar-thin mb-4 flex gap-2 overflow-x-auto rounded-lg bg-slate-50 p-1">
          {tabConfig.map((tab) => {
            const Icon = tab.icon;
            const count = tab.key === "all" ? allAlerts.length : data?.[tab.key]?.length ?? 0;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={clsx(
                  "inline-flex h-10 flex-shrink-0 items-center gap-2 rounded-md px-3 text-sm font-semibold",
                  activeTab === tab.key ? "bg-white text-brand shadow-sm" : "text-muted hover:text-ink"
                )}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
                <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px]">{count}</span>
              </button>
            );
          })}
        </div>

        {visible.length === 0 ? (
          <EmptyState title="Nenhum alerta" description="Tudo certo para este recorte." />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {visible.map((activity) => (
              <button
                key={`${activeTab}-${activity.id}`}
                type="button"
                onClick={() => onOpenActivity(activity.id)}
                className="rounded-lg border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-brand hover:shadow-card"
              >
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-ink">{activity.title}</p>
                    <p className="mt-1 text-xs text-muted">Prazo: {formatDate(activity.dueDate)}</p>
                  </div>
                  <PriorityBadge priority={activity.priority} compact />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={activity.status} compact />
                  {activity.blockedReason ? (
                    <span className="rounded-md bg-red-50 px-2 py-1 text-[11px] font-semibold text-red-700">
                      {activity.blockedReason}
                    </span>
                  ) : null}
                  <span className="text-xs font-semibold text-muted">
                    {activity.assignee?.name ?? "Sem responsável"}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
