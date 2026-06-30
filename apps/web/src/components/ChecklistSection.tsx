import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useAddChecklistItem, useRemoveChecklistItem, useUpdateChecklistItem } from "../hooks/useChecklist";
import type { Activity } from "../types";
import { getChecklistProgress } from "../utils/format";

export function ChecklistSection({ activity }: { activity: Activity }) {
  const [title, setTitle] = useState("");
  const progress = getChecklistProgress(activity);
  const addItem = useAddChecklistItem(activity.id);
  const updateItem = useUpdateChecklistItem(activity.id);
  const removeItem = useRemoveChecklistItem(activity.id);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    addItem.mutate(title.trim(), {
      onSuccess: () => setTitle("")
    });
  }

  return (
    <section>
      <div className="mb-4">
        <div className="mb-2 flex items-center justify-between text-sm font-semibold text-ink">
          <span>Progresso</span>
          <span>
            {progress.done}/{progress.total}
          </span>
        </div>
        <div className="h-2 rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-emerald-500" style={{ width: `${progress.percent}%` }} />
        </div>
      </div>

      <div className="space-y-2">
        {activity.checklist.map((item) => (
          <div key={item.id} className="flex items-center gap-3 rounded-md border border-slate-100 bg-white p-2">
            <input
              type="checkbox"
              checked={item.isDone}
              onChange={(event) => updateItem.mutate({ itemId: item.id, isDone: event.target.checked })}
              className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand"
            />
            <span className={`flex-1 text-sm ${item.isDone ? "text-slate-400 line-through" : "text-ink"}`}>
              {item.title}
            </span>
            <button
              type="button"
              onClick={() => removeItem.mutate(item.id)}
              className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
              aria-label="Remover item"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      <form onSubmit={submit} className="mt-4 flex gap-2">
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="h-10 min-w-0 flex-1 rounded-md border border-line px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
          placeholder="Novo item"
        />
        <button
          type="submit"
          className="inline-flex h-10 items-center gap-2 rounded-md bg-ink px-3 text-sm font-semibold text-white hover:bg-slate-800"
        >
          <Plus className="h-4 w-4" />
          Adicionar
        </button>
      </form>
    </section>
  );
}
