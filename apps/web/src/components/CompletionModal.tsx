import { Check, PartyPopper } from "lucide-react";
import type { Activity, AuthUser } from "../types";
import { formatDateTime } from "../utils/format";

export function CompletionModal({
  activity,
  user,
  onClose
}: {
  activity: Activity | null;
  user: AuthUser;
  onClose: () => void;
}) {
  if (!activity) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/45 px-4">
      <div className="w-full max-w-lg rounded-lg border border-slate-200 bg-white p-8 text-center shadow-panel">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-200">
          <Check className="h-10 w-10" />
        </div>
        <div className="mt-5 inline-flex items-center gap-2 rounded-md bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700">
          <PartyPopper className="h-4 w-4" />
          Atividade concluída
        </div>
        <h2 className="mt-4 text-2xl font-bold text-ink">Tudo certo por aqui.</h2>
        <p className="mt-2 text-sm text-muted">A atividade foi finalizada e movida para Concluído.</p>

        <dl className="mx-auto mt-6 grid max-w-sm gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-left text-sm">
          <div>
            <dt className="font-semibold text-muted">Atividade</dt>
            <dd className="font-bold text-ink">{activity.title}</dd>
          </div>
          <div>
            <dt className="font-semibold text-muted">Concluída por</dt>
            <dd className="font-bold text-ink">{user.name}</dd>
          </div>
          <div>
            <dt className="font-semibold text-muted">Concluída em</dt>
            <dd className="font-bold text-ink">{formatDateTime(activity.completedAt)}</dd>
          </div>
        </dl>

        <button
          type="button"
          onClick={onClose}
          className="mt-6 h-11 w-full rounded-md bg-brand px-4 text-sm font-semibold text-white hover:bg-violet-700"
        >
          Ver no board
        </button>
      </div>
    </div>
  );
}
