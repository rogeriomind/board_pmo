import { DndContext, type DragEndEvent, PointerSensor, pointerWithin, useSensor, useSensors } from "@dnd-kit/core";
import { AlertTriangle } from "lucide-react";
import { useState } from "react";
import type { Activity, ActivityFilters, ActivityStatus } from "../types";
import { STATUSES, STATUS_LABELS } from "../types";
import { useActivities, useMoveActivity } from "../hooks/useActivities";
import { ConfirmDialog } from "./ConfirmDialog";
import { EmptyState } from "./EmptyState";
import { KanbanColumn } from "./KanbanColumn";
import { LoadingSkeleton } from "./LoadingSkeleton";

export function KanbanBoard({
  filters,
  onCreate,
  onOpenActivity
}: {
  filters: ActivityFilters;
  onCreate: (status: ActivityStatus) => void;
  onOpenActivity: (activityId: string) => void;
}) {
  const { data, isLoading, isError, error } = useActivities(filters);
  const moveActivity = useMoveActivity();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const [pendingMove, setPendingMove] = useState<{ activity: Activity; status: ActivityStatus } | null>(null);

  function handleDragEnd(event: DragEndEvent) {
    const activity = event.active.data.current?.activity as Activity | undefined;
    const target = event.over?.id as ActivityStatus | undefined;

    if (!activity || !target || !STATUSES.includes(target) || activity.status === target) {
      return;
    }

    if (target === "BLOCKED" || target === "CANCELED") {
      setPendingMove({ activity, status: target });
      return;
    }

    moveActivity.mutate({ activityId: activity.id, status: target });
  }

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-3">
        <LoadingSkeleton lines={3} />
        <LoadingSkeleton lines={3} />
        <LoadingSkeleton lines={3} />
      </div>
    );
  }

  if (isError) {
    return (
      <EmptyState
        title="Não foi possível carregar o board"
        description={error.message}
        action={
          <span className="inline-flex items-center gap-2 rounded-md bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
            <AlertTriangle className="h-4 w-4" />
            Verifique a API
          </span>
        }
      />
    );
  }

  return (
    <>
      <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragEnd={handleDragEnd}>
        <div className="scrollbar-thin flex min-h-[calc(100vh-9.5rem)] gap-4 overflow-x-auto pb-3">
          {STATUSES.map((status) => (
            <KanbanColumn
              key={status}
              status={status}
              activities={data?.[status] ?? []}
              onCreate={onCreate}
              onOpenActivity={onOpenActivity}
            />
          ))}
        </div>
      </DndContext>

      <ConfirmDialog
        open={Boolean(pendingMove)}
        title={`Mover para ${pendingMove ? STATUS_LABELS[pendingMove.status] : ""}`}
        description="Esta transição exige um motivo para manter o histórico útil."
        confirmLabel="Mover card"
        requireReason
        reasonLabel={pendingMove?.status === "BLOCKED" ? "Motivo do bloqueio" : "Motivo do cancelamento"}
        variant={pendingMove?.status === "CANCELED" ? "danger" : "primary"}
        onClose={() => setPendingMove(null)}
        onConfirm={(reason) => {
          if (pendingMove) {
            moveActivity.mutate({ activityId: pendingMove.activity.id, status: pendingMove.status, reason });
            setPendingMove(null);
          }
        }}
      />
    </>
  );
}
