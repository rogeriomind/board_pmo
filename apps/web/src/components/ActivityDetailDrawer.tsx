import clsx from "clsx";
import {
  Ban,
  CalendarDays,
  CheckCircle2,
  FileText,
  History,
  MessageSquare,
  MoveRight,
  Paperclip,
  Pencil,
  UserRound,
  X
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useActivityDetail, useMoveActivity } from "../hooks/useActivities";
import type { Activity, ActivityStatus } from "../types";
import { STATUSES, STATUS_LABELS } from "../types";
import { formatDate, formatDateTime } from "../utils/format";
import { ActivityEditForm } from "./ActivityEditForm";
import { Avatar } from "./Avatar";
import { ChecklistSection } from "./ChecklistSection";
import { CommentsSection } from "./CommentsSection";
import { ConfirmDialog } from "./ConfirmDialog";
import { EmptyState } from "./EmptyState";
import { HistoryTimeline } from "./HistoryTimeline";
import { LoadingSkeleton } from "./LoadingSkeleton";
import { PriorityBadge } from "./PriorityBadge";
import { StatusBadge } from "./StatusBadge";

type TabKey = "checklist" | "attachments" | "comments" | "history";

const tabs: Array<{ key: TabKey; label: string; icon: typeof CheckCircle2 }> = [
  { key: "checklist", label: "Checklist", icon: CheckCircle2 },
  { key: "attachments", label: "Anexos", icon: Paperclip },
  { key: "comments", label: "Comentários", icon: MessageSquare },
  { key: "history", label: "Histórico", icon: History }
];

export function ActivityDetailDrawer({
  activityId,
  onClose,
  onCompleted
}: {
  activityId: string | null;
  onClose: () => void;
  onCompleted: (activity: Activity) => void;
}) {
  const { data: activity, isLoading } = useActivityDetail(activityId);
  const moveActivity = useMoveActivity();
  const [tab, setTab] = useState<TabKey>("checklist");
  const [editing, setEditing] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [targetStatus, setTargetStatus] = useState<ActivityStatus>("TODO");

  useEffect(() => {
    setEditing(false);
    setTab("checklist");
    if (activity) setTargetStatus(activity.status);
  }, [activity?.id]);

  const requireReason = targetStatus === "BLOCKED" || targetStatus === "CANCELED";
  const attachmentCount = activity?.attachments?.length ?? 0;
  const commentCount = activity?.comments?.length ?? 0;
  const historyCount = activity?.history?.length ?? 0;
  const tabCounts = useMemo(
    () => ({
      checklist: activity?.checklist.length ?? 0,
      attachments: attachmentCount,
      comments: commentCount,
      history: historyCount
    }),
    [activity?.checklist.length, attachmentCount, commentCount, historyCount]
  );

  if (!activityId) return null;

  return (
    <>
      <div className="fixed inset-0 z-30 bg-ink/25" onClick={onClose} />
      <aside className="fixed inset-y-0 right-0 z-40 flex w-full max-w-2xl flex-col border-l border-slate-200 bg-white shadow-panel">
        <header className="border-b border-slate-200 p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-wide text-brand">Detalhe do card</p>
              <h2 className="mt-1 text-xl font-bold text-ink">{activity?.title ?? "Carregando..."}</h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-ink"
              aria-label="Fechar detalhe"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </header>

        <div className="scrollbar-thin flex-1 overflow-y-auto p-5">
          {isLoading || !activity ? (
            <LoadingSkeleton lines={4} />
          ) : editing ? (
            <ActivityEditForm activity={activity} onCancel={() => setEditing(false)} onSaved={() => setEditing(false)} />
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={activity.status} />
                <PriorityBadge priority={activity.priority} />
                {activity.blockedReason ? (
                  <span className="rounded-md bg-red-50 px-2 py-1 text-xs font-semibold text-red-700">
                    {activity.blockedReason}
                  </span>
                ) : null}
              </div>

              <div className="mt-5 grid gap-3 border-y border-slate-100 py-4 sm:grid-cols-3">
                <InfoTile
                  icon={UserRound}
                  label="Responsável"
                  value={activity.assignee?.name ?? "Sem responsável"}
                  avatar={activity.assignee ? <Avatar user={activity.assignee} size="sm" /> : null}
                />
                <InfoTile icon={CalendarDays} label="Prazo" value={formatDate(activity.dueDate)} />
                <InfoTile icon={FileText} label="Criado em" value={formatDateTime(activity.createdAt)} />
              </div>

              <section className="mt-5">
                <h3 className="text-sm font-bold text-ink">Descrição</h3>
                <p className="mt-2 rounded-lg bg-slate-50 p-4 text-sm leading-6 text-slate-700">
                  {activity.description || "Sem descrição."}
                </p>
              </section>

              {activity.tags.length > 0 ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {activity.tags.map((tag) => (
                    <span
                      key={tag.id}
                      className="rounded-md px-2 py-1 text-xs font-semibold"
                      style={{ color: tag.color, backgroundColor: `${tag.color}18` }}
                    >
                      {tag.name}
                    </span>
                  ))}
                </div>
              ) : null}

              <div className="mt-6 border-b border-slate-200">
                <div className="scrollbar-thin flex gap-2 overflow-x-auto">
                  {tabs.map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => setTab(item.key)}
                        className={clsx(
                          "inline-flex h-11 items-center gap-2 border-b-2 px-3 text-sm font-semibold",
                          tab === item.key
                            ? "border-brand text-brand"
                            : "border-transparent text-muted hover:text-ink"
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        {item.label}
                        <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px]">{tabCounts[item.key]}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mt-5">
                {tab === "checklist" ? <ChecklistSection activity={activity} /> : null}
                {tab === "attachments" ? (
                  attachmentCount ? (
                    <div className="space-y-2">
                      {activity.attachments?.map((attachment) => (
                        <a
                          key={attachment.id}
                          href={attachment.fileUrl}
                          className="flex items-center gap-3 rounded-lg border border-slate-100 bg-white p-3 text-sm font-semibold text-ink hover:border-brand"
                        >
                          <Paperclip className="h-4 w-4 text-brand" />
                          {attachment.fileName}
                        </a>
                      ))}
                    </div>
                  ) : (
                    <EmptyState title="Sem anexos" description="Arquivos adicionados aparecerão nesta área." />
                  )
                ) : null}
                {tab === "comments" ? <CommentsSection activity={activity} /> : null}
                {tab === "history" ? <HistoryTimeline activity={activity} /> : null}
              </div>
            </>
          )}
        </div>

        {activity && !editing ? (
          <footer className="border-t border-slate-200 p-4">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <button
                type="button"
                onClick={() => setMoveOpen(true)}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-line text-sm font-semibold text-ink hover:bg-slate-50"
              >
                <MoveRight className="h-4 w-4" />
                Mover
              </button>
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-line text-sm font-semibold text-ink hover:bg-slate-50"
              >
                <Pencil className="h-4 w-4" />
                Editar
              </button>
              <button
                type="button"
                onClick={() =>
                  moveActivity.mutate(
                    { activityId: activity.id, status: "DONE" },
                    {
                      onSuccess: (updated) => {
                        onCompleted(updated);
                        onClose();
                      }
                    }
                  )
                }
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-emerald-600 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                <CheckCircle2 className="h-4 w-4" />
                Concluir
              </button>
              <button
                type="button"
                onClick={() => setCancelOpen(true)}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-red-50 text-sm font-semibold text-red-700 hover:bg-red-100"
              >
                <Ban className="h-4 w-4" />
                Cancelar
              </button>
            </div>
          </footer>
        ) : null}
      </aside>

      <ConfirmDialog
        open={moveOpen}
        title="Mover atividade"
        description="Escolha o novo status. Algumas transições serão validadas pela API."
        confirmLabel="Mover"
        requireReason={requireReason}
        reasonLabel={targetStatus === "BLOCKED" ? "Motivo do bloqueio" : "Motivo do cancelamento"}
        onClose={() => setMoveOpen(false)}
        onConfirm={(reason) => {
          if (!activity) return;
          moveActivity.mutate({ activityId: activity.id, status: targetStatus, reason });
          setMoveOpen(false);
        }}
      >
        <label className="block text-sm font-semibold text-ink">
          Status
          <select
            value={targetStatus}
            onChange={(event) => setTargetStatus(event.target.value as ActivityStatus)}
            className="mt-2 h-10 w-full rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
          >
            {STATUSES.map((status) => (
              <option key={status} value={status}>
                {STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </label>
      </ConfirmDialog>

      <ConfirmDialog
        open={cancelOpen}
        title="Cancelar atividade"
        description="O card será movido para Cancelado e o motivo ficará registrado."
        confirmLabel="Cancelar atividade"
        variant="danger"
        requireReason
        reasonLabel="Motivo do cancelamento"
        onClose={() => setCancelOpen(false)}
        onConfirm={(reason) => {
          if (!activity) return;
          moveActivity.mutate({ activityId: activity.id, status: "CANCELED", reason });
          setCancelOpen(false);
        }}
      />
    </>
  );
}

function InfoTile({
  icon: Icon,
  label,
  value,
  avatar
}: {
  icon: typeof UserRound;
  label: string;
  value: string;
  avatar?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted">
        <Icon className="h-4 w-4" />
        {label}
      </div>
      <div className="flex items-center gap-2 text-sm font-bold text-ink">
        {avatar}
        <span className="min-w-0 truncate">{value}</span>
      </div>
    </div>
  );
}
