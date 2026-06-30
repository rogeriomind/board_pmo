import { useDraggable } from "@dnd-kit/core";
import clsx from "clsx";
import { CalendarDays, CheckCircle2, GripVertical, LockKeyhole, UserRound } from "lucide-react";
import type { KeyboardEvent, MouseEvent } from "react";
import type { Activity } from "../types";
import { formatDate, getChecklistProgress, getDueState } from "../utils/format";
import { Avatar } from "./Avatar";
import { PriorityBadge } from "./PriorityBadge";

export function ActivityCard({
  activity,
  onOpen
}: {
  activity: Activity;
  onOpen: (activityId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: activity.id,
    data: { activity, from: activity.status }
  });
  const progress = getChecklistProgress(activity);
  const dueState = getDueState(activity);
  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`
      }
    : undefined;

  function openCard() {
    onOpen(activity.id);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openCard();
    }
  }

  function keepDragHandleIsolated(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
  }

  return (
    <article
      ref={setNodeRef}
      style={style}
      role="button"
      tabIndex={0}
      aria-label={`Abrir detalhe de ${activity.title}`}
      onClick={openCard}
      onKeyDown={handleKeyDown}
      className={clsx(
        "group rounded-lg border bg-white p-3 shadow-card transition hover:-translate-y-0.5 hover:border-brand/35 hover:shadow-panel focus:outline-none focus:ring-2 focus:ring-brand/30",
        isDragging && "z-40 opacity-70",
        dueState === "overdue" ? "border-red-200" : "border-slate-200",
        activity.status === "BLOCKED" && "bg-red-50/60"
      )}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          className="mt-0.5 rounded p-1 text-slate-300 opacity-0 transition hover:bg-slate-100 hover:text-slate-600 group-hover:opacity-100"
          aria-label="Arrastar card"
          onClick={keepDragHandleIsolated}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1 text-left">
          <h4 className="line-clamp-2 text-sm font-bold leading-5 text-ink">{activity.title}</h4>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <PriorityBadge priority={activity.priority} compact />
        {activity.status === "BLOCKED" ? (
          <span className="inline-flex items-center gap-1 rounded-md bg-red-100 px-2 py-1 text-[11px] font-semibold text-red-700">
            <LockKeyhole className="h-3 w-3" />
            Bloqueado
          </span>
        ) : null}
        {dueState === "overdue" ? (
          <span className="rounded-md bg-red-100 px-2 py-1 text-[11px] font-semibold text-red-700">
            Atrasado
          </span>
        ) : null}
        {dueState === "risk" ? (
          <span className="rounded-md bg-amber-100 px-2 py-1 text-[11px] font-semibold text-amber-700">
            Em risco
          </span>
        ) : null}
      </div>

      {activity.tags.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {activity.tags.slice(0, 3).map((tag) => (
            <span
              key={tag.id}
              className="rounded-md px-2 py-1 text-[11px] font-semibold"
              style={{ backgroundColor: `${tag.color}18`, color: tag.color }}
            >
              {tag.name}
            </span>
          ))}
        </div>
      ) : null}

      <div className="mt-4 flex items-center justify-between gap-3 text-xs text-muted">
        <span className="inline-flex items-center gap-1">
          <CalendarDays className="h-3.5 w-3.5" />
          {formatDate(activity.dueDate)}
        </span>
        <span className="inline-flex items-center gap-1">
          {activity.assignee ? <Avatar user={activity.assignee} size="sm" /> : <UserRound className="h-4 w-4" />}
        </span>
      </div>

      <div className="mt-4">
        <div className="mb-1 flex items-center justify-between text-[11px] font-semibold text-slate-500">
          <span className="inline-flex items-center gap-1">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Checklist
          </span>
          <span>{progress.percent}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-slate-100">
          <div
            className={clsx("h-full rounded-full", progress.percent === 100 ? "bg-emerald-500" : "bg-brand")}
            style={{ width: `${progress.percent}%` }}
          />
        </div>
      </div>
    </article>
  );
}
