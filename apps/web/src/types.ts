export type ActivityStatus =
  | "BACKLOG"
  | "TODO"
  | "IN_PROGRESS"
  | "BLOCKED"
  | "IN_REVIEW"
  | "DONE"
  | "CANCELED";

export type Priority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type User = {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
};

export type Tag = {
  id: string;
  name: string;
  color: string;
};

export type ChecklistItem = {
  id: string;
  activityId: string;
  title: string;
  isDone: boolean;
  createdAt: string;
  updatedAt: string;
};

export type Comment = {
  id: string;
  activityId: string;
  userId: string;
  user: User;
  message: string;
  createdAt: string;
};

export type Attachment = {
  id: string;
  activityId: string;
  fileName: string;
  fileUrl: string;
  fileType: string;
  createdAt: string;
};

export type HistoryItem = {
  id: string;
  activityId: string;
  userId: string;
  user: User;
  action: string;
  fieldChanged?: string | null;
  oldValue?: string | null;
  newValue?: string | null;
  createdAt: string;
};

export type Activity = {
  id: string;
  title: string;
  description?: string | null;
  status: ActivityStatus;
  priority: Priority;
  assigneeId?: string | null;
  assignee?: User | null;
  dueDate?: string | null;
  completedAt?: string | null;
  blockedReason?: string | null;
  canceledReason?: string | null;
  createdById: string;
  createdBy: User;
  tags: Tag[];
  checklist: ChecklistItem[];
  comments?: Comment[];
  attachments?: Attachment[];
  history?: HistoryItem[];
  createdAt: string;
  updatedAt: string;
};

export type ActivityGroups = Record<ActivityStatus, Activity[]>;

export type ActivityFilters = {
  search?: string;
  assigneeId?: string;
  priority?: Priority | "";
  status?: ActivityStatus | "";
};

export type AlertGroups = {
  overdue: Activity[];
  atRisk: Activity[];
  blocked: Activity[];
  withoutAssignee: Activity[];
  nearDueDate: Activity[];
};

export type AuthUser = User;

export const STATUSES: ActivityStatus[] = [
  "BACKLOG",
  "TODO",
  "IN_PROGRESS",
  "BLOCKED",
  "IN_REVIEW",
  "DONE",
  "CANCELED"
];

export const STATUS_LABELS: Record<ActivityStatus, string> = {
  BACKLOG: "Backlog",
  TODO: "A Fazer",
  IN_PROGRESS: "Em Andamento",
  BLOCKED: "Bloqueado",
  IN_REVIEW: "Em Validação",
  DONE: "Concluído",
  CANCELED: "Cancelado"
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  LOW: "Baixa",
  MEDIUM: "Média",
  HIGH: "Alta",
  CRITICAL: "Crítica"
};
