import { Filter, Plus, Search, SlidersHorizontal } from "lucide-react";
import type { ActivityFilters, ActivityStatus, AuthUser, Priority } from "../types";
import { PRIORITY_LABELS, STATUSES, STATUS_LABELS } from "../types";
import { useUsers } from "../hooks/useUsers";
import { Avatar } from "./Avatar";

type View = "board" | "alerts";

export function Topbar({
  activeView,
  filters,
  user,
  onChangeFilters,
  onCreate
}: {
  activeView: View;
  filters: ActivityFilters;
  user: AuthUser;
  onChangeFilters: (filters: ActivityFilters) => void;
  onCreate: () => void;
}) {
  const users = useUsers();

  function patchFilters(next: Partial<ActivityFilters>) {
    onChangeFilters({ ...filters, ...next });
  }

  return (
    <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/85 px-4 py-3 backdrop-blur md:px-6">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-50 text-brand">
            <SlidersHorizontal className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-ink">PMO Board</h1>
            <p className="text-sm text-muted">
              {activeView === "board" ? "Gestão de atividades e projetos" : "Alertas operacionais do board"}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          {activeView === "board" ? (
            <div className="grid gap-2 sm:grid-cols-2 lg:flex lg:items-center">
              <label className="relative sm:col-span-2 lg:w-72">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={filters.search ?? ""}
                  onChange={(event) => patchFilters({ search: event.target.value })}
                  className="h-10 w-full rounded-md border border-line bg-white pl-9 pr-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
                  placeholder="Buscar atividades..."
                />
              </label>

              <select
                value={filters.assigneeId ?? ""}
                onChange={(event) => patchFilters({ assigneeId: event.target.value })}
                className="h-10 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
                aria-label="Filtrar responsável"
              >
                <option value="">Responsável</option>
                {users.data?.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>

              <select
                value={filters.priority ?? ""}
                onChange={(event) => patchFilters({ priority: event.target.value as Priority | "" })}
                className="h-10 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
                aria-label="Filtrar prioridade"
              >
                <option value="">Prioridade</option>
                {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>

              <select
                value={filters.status ?? ""}
                onChange={(event) => patchFilters({ status: event.target.value as ActivityStatus | "" })}
                className="h-10 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
                aria-label="Filtrar status"
              >
                <option value="">Status</option>
                {STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {STATUS_LABELS[status]}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="inline-flex h-10 items-center gap-2 rounded-md border border-line bg-white px-3 text-sm font-semibold text-muted">
              <Filter className="h-4 w-4" />
              Visão de alertas
            </div>
          )}

          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onCreate}
              className="inline-flex h-10 items-center gap-2 rounded-md bg-brand px-4 text-sm font-semibold text-white shadow-sm hover:bg-violet-700"
            >
              <Plus className="h-4 w-4" />
              Nova Atividade
            </button>
            <Avatar user={user} />
          </div>
        </div>
      </div>
    </header>
  );
}
