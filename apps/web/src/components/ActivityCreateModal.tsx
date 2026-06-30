import { zodResolver } from "@hookform/resolvers/zod";
import { Paperclip, Plus, X } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useCreateActivity } from "../hooks/useActivities";
import { useUsers } from "../hooks/useUsers";
import type { ActivityStatus, Priority } from "../types";
import { PRIORITY_LABELS, STATUSES, STATUS_LABELS } from "../types";

const createSchema = z.object({
  title: z.string().min(3, "Informe um título."),
  description: z.string().min(3, "Informe uma descrição."),
  assigneeId: z.string().optional(),
  dueDate: z.string().min(10, "Informe o prazo."),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  status: z.enum(["BACKLOG", "TODO", "IN_PROGRESS", "BLOCKED", "IN_REVIEW", "DONE", "CANCELED"]),
  tags: z.string().optional(),
  checklist: z.string().optional()
});

type FormValues = z.infer<typeof createSchema>;

export function ActivityCreateModal({
  open,
  initialStatus,
  onClose
}: {
  open: boolean;
  initialStatus: ActivityStatus;
  onClose: () => void;
}) {
  const users = useUsers();
  const createActivity = useCreateActivity();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors }
  } = useForm<FormValues>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      title: "",
      description: "",
      assigneeId: "",
      dueDate: "",
      priority: "MEDIUM",
      status: initialStatus,
      tags: "",
      checklist: ""
    }
  });

  useEffect(() => {
    if (open) {
      reset({
        title: "",
        description: "",
        assigneeId: "",
        dueDate: "",
        priority: "MEDIUM",
        status: initialStatus,
        tags: "",
        checklist: ""
      });
    }
  }, [initialStatus, open, reset]);

  if (!open) return null;

  function submit(values: FormValues) {
    createActivity.mutate(
      {
        title: values.title,
        description: values.description,
        assigneeId: values.assigneeId || null,
        dueDate: values.dueDate,
        priority: values.priority as Priority,
        status: values.status as ActivityStatus,
        tags: values.tags?.split(",").map((tag) => tag.trim()).filter(Boolean) ?? [],
        checklist:
          values.checklist
            ?.split("\n")
            .map((item) => item.trim())
            .filter(Boolean) ?? []
      },
      { onSuccess: onClose }
    );
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink/45 px-4 py-8">
      <form
        onSubmit={handleSubmit(submit)}
        className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-slate-200 bg-white p-6 shadow-panel"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-ink">Nova atividade</h2>
            <p className="mt-1 text-sm text-muted">Crie o card e envie para a coluna correta.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-ink"
            aria-label="Fechar modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <label className="md:col-span-2">
            <span className="text-sm font-semibold text-ink">Título *</span>
            <input
              {...register("title")}
              className="mt-2 h-11 w-full rounded-md border border-line px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
              placeholder="Configurar lembrete automático"
            />
            {errors.title ? <span className="mt-1 block text-xs text-red-600">{errors.title.message}</span> : null}
          </label>

          <label className="md:col-span-2">
            <span className="text-sm font-semibold text-ink">Descrição *</span>
            <textarea
              {...register("description")}
              className="mt-2 min-h-24 w-full resize-none rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
              placeholder="Descreva o objetivo e os combinados principais."
            />
            {errors.description ? (
              <span className="mt-1 block text-xs text-red-600">{errors.description.message}</span>
            ) : null}
          </label>

          <label>
            <span className="text-sm font-semibold text-ink">Responsável</span>
            <select
              {...register("assigneeId")}
              className="mt-2 h-11 w-full rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
            >
              <option value="">Sem responsável</option>
              {users.data?.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span className="text-sm font-semibold text-ink">Prazo *</span>
            <input
              type="date"
              {...register("dueDate")}
              className="mt-2 h-11 w-full rounded-md border border-line px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
            />
            {errors.dueDate ? <span className="mt-1 block text-xs text-red-600">{errors.dueDate.message}</span> : null}
          </label>

          <label>
            <span className="text-sm font-semibold text-ink">Prioridade *</span>
            <select
              {...register("priority")}
              className="mt-2 h-11 w-full rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
            >
              {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span className="text-sm font-semibold text-ink">Status inicial *</span>
            <select
              {...register("status")}
              className="mt-2 h-11 w-full rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
            >
              {STATUSES.map((status) => (
                <option key={status} value={status}>
                  {STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </label>

          <label className="md:col-span-2">
            <span className="text-sm font-semibold text-ink">Tags</span>
            <input
              {...register("tags")}
              className="mt-2 h-11 w-full rounded-md border border-line px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
              placeholder="Automação, WhatsApp, Comunicação"
            />
          </label>

          <label className="md:col-span-2">
            <span className="text-sm font-semibold text-ink">Checklist inicial</span>
            <textarea
              {...register("checklist")}
              className="mt-2 min-h-24 w-full resize-none rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
              placeholder={"Mapear fluxo atual\nDefinir regras de lembrete"}
            />
          </label>
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-line px-4 text-sm font-semibold text-ink hover:bg-slate-50"
          >
            <Paperclip className="h-4 w-4" />
            Adicionar anexo
          </button>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="h-10 rounded-md border border-line px-5 text-sm font-semibold text-ink hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={createActivity.isPending}
              className="inline-flex h-10 items-center gap-2 rounded-md bg-brand px-5 text-sm font-semibold text-white shadow-sm hover:bg-violet-700 disabled:opacity-60"
            >
              <Plus className="h-4 w-4" />
              Criar atividade
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
