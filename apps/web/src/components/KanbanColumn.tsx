import { useDroppable } from "@dnd-kit/core";
import clsx from "clsx";
import { Plus } from "lucide-react";
import type { Activity, ActivityStatus } from "../types";
import { STATUS_LABELS } from "../types";
import { ActivityCard } from "./ActivityCard";
import { EmptyState } from "./EmptyState";

const columnStyles: Record<ActivityStatus, string> = {
  BACKLOG: "bg-slate-50 text-slate-700",
  TODO: "bg-violet-50 text-violet-700",
  IN_PROGRESS: "bg-blue-50 text-blue-700",
  BLOCKED: "bg-red-50 text-red-700",
  IN_REVIEW: "bg-amber-50 text-amber-700",
  DONE: "bg-emerald-50 text-emerald-700",
  CANCELED: "bg-zinc-100 text-zinc-600"
};

export function KanbanColumn({
  status,
  activities,
  onCreate,
  onOpenActivity
}: {
  status: ActivityStatus;
  activities: Activity[];
  onCreate: (status: ActivityStatus) => void;
  onOpenActivity: (activityId: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <section
      ref={setNodeRef}
      className={clsx(
        "flex h-full min-h-[31rem] w-[18.5rem] flex-shrink-0 flex-col rounded-lg border border-slate-200 bg-white/75 p-3 transition",
        isOver && "border-brand bg-violet-50/60"
      )}
    >
      <header className={clsx("mb-3 flex items-center justify-between rounded-md px-3 py-2", columnStyles[status])}>
        <h3 className="text-sm font-bold">{STATUS_LABELS[status]}</h3>
        <span className="rounded-md bg-white/80 px-2 py-0.5 text-xs font-bold">{activities.length}</span>
      </header>

      <div className="scrollbar-thin flex-1 space-y-3 overflow-y-auto pr-1">
        {activities.length === 0 ? (
          <EmptyState title="Sem cards" description="Nada nesta etapa agora." />
        ) : (
          activities.map((activity) => (
            <ActivityCard key={activity.id} activity={activity} onOpen={onOpenActivity} />
          ))
        )}
      </div>

      <button
        type="button"
        onClick={() => onCreate(status)}
        className="mt-3 inline-flex h-10 items-center justify-center gap-2 rounded-md border border-dashed border-slate-300 bg-white text-sm font-semibold text-brand hover:border-brand hover:bg-violet-50"
      >
        <Plus className="h-4 w-4" />
        Adicionar card
      </button>
    </section>
  );
}
