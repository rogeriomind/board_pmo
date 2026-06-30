import { differenceInCalendarDays, format, isValid, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Activity } from "../types";

export function formatDate(value?: string | null) {
  if (!value) return "Sem prazo";
  const date = parseISO(value);
  return isValid(date) ? format(date, "dd/MM/yyyy", { locale: ptBR }) : "Sem prazo";
}

export function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const date = parseISO(value);
  return isValid(date) ? format(date, "dd/MM/yyyy HH:mm", { locale: ptBR }) : "-";
}

export function getChecklistProgress(activity: Pick<Activity, "checklist">) {
  const total = activity.checklist.length;
  const done = activity.checklist.filter((item) => item.isDone).length;
  return {
    total,
    done,
    percent: total === 0 ? 0 : Math.round((done / total) * 100)
  };
}

export function getDueState(activity: Pick<Activity, "dueDate" | "status">) {
  if (!activity.dueDate || activity.status === "DONE" || activity.status === "CANCELED") {
    return "normal";
  }

  const days = differenceInCalendarDays(parseISO(activity.dueDate), new Date());

  if (days < 0) return "overdue";
  if (days <= 2) return "risk";
  return "normal";
}

export function initials(name?: string | null) {
  return (
    name
      ?.split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "?"
  );
}
