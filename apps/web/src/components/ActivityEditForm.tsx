import { zodResolver } from "@hookform/resolvers/zod";
import { Save } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useUpdateActivity } from "../hooks/useActivities";
import { useUsers } from "../hooks/useUsers";
import type { Activity, Priority } from "../types";
import { PRIORITY_LABELS } from "../types";

const editSchema = z.object({
  title: z.string().min(3, "Informe um título."),
  description: z.string().min(3, "Informe uma descrição."),
  assigneeId: z.string().optional(),
  dueDate: z.string().min(10, "Informe o prazo."),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  tags: z.string().optional(),
  checklist: z.string().optional()
});

type FormValues = z.infer<typeof editSchema>;

export function ActivityEditForm({
  activity,
  onCancel,
  onSaved
}: {
  activity: Activity;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const users = useUsers();
  const updateActivity = useUpdateActivity(activity.id);
  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<FormValues>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      title: activity.title,
      description: activity.description ?? "",
      assigneeId: activity.assigneeId ?? "",
      dueDate: activity.dueDate?.slice(0, 10) ?? "",
      priority: activity.priority,
      tags: activity.tags.map((tag) => tag.name).join(", "),
      checklist: activity.checklist.map((item) => item.title).join("\n")
    }
  });

  function submit(values: FormValues) {
    updateActivity.mutate(
      {
        title: values.title,
        description: values.description,
        assigneeId: values.assigneeId || null,
        dueDate: values.dueDate,
        priority: values.priority as Priority,
        tags: values.tags?.split(",").map((tag) => tag.trim()).filter(Boolean) ?? [],
        checklist:
          values.checklist
            ?.split("\n")
            .map((item) => item.trim())
            .filter(Boolean) ?? []
      },
      { onSuccess: onSaved }
    );
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-4">
      <label className="block">
        <span className="text-sm font-semibold text-ink">Título</span>
        <input
          {...register("title")}
          className="mt-2 h-10 w-full rounded-md border border-line px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
        />
        {errors.title ? <span className="text-xs text-red-600">{errors.title.message}</span> : null}
      </label>

      <label className="block">
        <span className="text-sm font-semibold text-ink">Descrição</span>
        <textarea
          {...register("description")}
          className="mt-2 min-h-24 w-full resize-none rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label>
          <span className="text-sm font-semibold text-ink">Responsável</span>
          <select
            {...register("assigneeId")}
            className="mt-2 h-10 w-full rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
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
          <span className="text-sm font-semibold text-ink">Prazo</span>
          <input
            type="date"
            {...register("dueDate")}
            className="mt-2 h-10 w-full rounded-md border border-line px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
          />
        </label>

        <label>
          <span className="text-sm font-semibold text-ink">Prioridade</span>
          <select
            {...register("priority")}
            className="mt-2 h-10 w-full rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
          >
            {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span className="text-sm font-semibold text-ink">Tags</span>
          <input
            {...register("tags")}
            className="mt-2 h-10 w-full rounded-md border border-line px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
          />
        </label>
      </div>

      <label className="block">
        <span className="text-sm font-semibold text-ink">Checklist</span>
        <textarea
          {...register("checklist")}
          className="mt-2 min-h-28 w-full resize-none rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
        />
      </label>

      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="h-10 rounded-md border border-line px-4 text-sm font-semibold text-ink hover:bg-slate-50"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={updateActivity.isPending}
          className="inline-flex h-10 items-center gap-2 rounded-md bg-brand px-4 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
        >
          <Save className="h-4 w-4" />
          Salvar alterações
        </button>
      </div>
    </form>
  );
}
