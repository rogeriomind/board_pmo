import clsx from "clsx";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "primary" | "danger";
  requireReason?: boolean;
  reasonLabel?: string;
  children?: ReactNode;
  onClose: () => void;
  onConfirm: (reason?: string) => void;
};

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  variant = "primary",
  requireReason = false,
  reasonLabel = "Motivo",
  children,
  onClose,
  onConfirm
}: ConfirmDialogProps) {
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (open) setReason("");
  }, [open]);

  if (!open) return null;

  const disabled = requireReason && reason.trim().length < 3;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/45 px-4">
      <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-5 shadow-panel">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-ink">{title}</h3>
            {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
          </div>
          <button
            type="button"
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-ink"
            onClick={onClose}
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {children ? <div className="mt-4">{children}</div> : null}

        {requireReason ? (
          <label className="mt-4 block text-sm font-semibold text-ink">
            {reasonLabel}
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              className="mt-2 min-h-24 w-full resize-none rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
              placeholder="Descreva o motivo"
            />
          </label>
        ) : null}

        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-line px-4 py-2 text-sm font-semibold text-ink hover:bg-slate-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onConfirm(reason)}
            className={clsx(
              "rounded-md px-4 py-2 text-sm font-semibold text-white shadow-sm disabled:opacity-50",
              variant === "danger" ? "bg-red-600 hover:bg-red-700" : "bg-brand hover:bg-violet-700"
            )}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
