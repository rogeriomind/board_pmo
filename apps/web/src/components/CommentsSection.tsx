import { Send } from "lucide-react";
import { useState } from "react";
import { useAddComment } from "../hooks/useComments";
import type { Activity } from "../types";
import { formatDateTime } from "../utils/format";
import { Avatar } from "./Avatar";
import { EmptyState } from "./EmptyState";

export function CommentsSection({ activity }: { activity: Activity }) {
  const [message, setMessage] = useState("");
  const addComment = useAddComment(activity.id);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!message.trim()) return;
    addComment.mutate(message.trim(), {
      onSuccess: () => setMessage("")
    });
  }

  return (
    <section className="space-y-4">
      {activity.comments?.length ? (
        <div className="space-y-3">
          {activity.comments.map((comment) => (
            <div key={comment.id} className="rounded-lg border border-slate-100 bg-white p-3">
              <div className="mb-2 flex items-center gap-2">
                <Avatar user={comment.user} size="sm" />
                <div>
                  <p className="text-sm font-bold text-ink">{comment.user.name}</p>
                  <p className="text-xs text-muted">{formatDateTime(comment.createdAt)}</p>
                </div>
              </div>
              <p className="text-sm text-slate-700">{comment.message}</p>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState title="Sem comentários" description="Registre alinhamentos importantes por aqui." />
      )}

      <form onSubmit={submit} className="rounded-lg border border-slate-100 bg-white p-3">
        <textarea
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          className="min-h-20 w-full resize-none rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
          placeholder="Escreva um comentário"
        />
        <div className="mt-2 flex justify-end">
          <button
            type="submit"
            className="inline-flex h-9 items-center gap-2 rounded-md bg-brand px-3 text-sm font-semibold text-white hover:bg-violet-700"
          >
            <Send className="h-4 w-4" />
            Enviar
          </button>
        </div>
      </form>
    </section>
  );
}
