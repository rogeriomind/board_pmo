import { Inbox } from "lucide-react";
import type { ReactNode } from "react";

export function EmptyState({
  title,
  description,
  action
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex min-h-32 flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-white/70 p-5 text-center">
      <Inbox className="mb-3 h-8 w-8 text-slate-300" />
      <p className="text-sm font-semibold text-ink">{title}</p>
      {description ? <p className="mt-1 text-xs text-muted">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
