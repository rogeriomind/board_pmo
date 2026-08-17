import { ActivityStatus, Priority } from "@prisma/client";

type BoardTask = {
  id: string;
  title: string;
  status: ActivityStatus;
  priority: Priority;
  assigneeId?: string | null;
  assignee?: unknown;
  dueDate?: Date | string | null;
  blockedReason?: string | null;
  tags?: unknown;
  [key: string]: unknown;
};

type GroupedTasks = Partial<Record<ActivityStatus, BoardTask[]>>;

export function flattenGroupedTasks(grouped: unknown) {
  if (!grouped || typeof grouped !== "object") {
    return [];
  }

  return Object.values(grouped as GroupedTasks).flatMap((tasks) => tasks ?? []);
}

function parseTaskDate(value: unknown) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

function taskSummary(task: BoardTask) {
  return {
    id: task.id,
    title: task.title,
    status: task.status,
    priority: task.priority,
    assigneeId: task.assigneeId ?? null,
    assignee: task.assignee ?? null,
    dueDate: task.dueDate ?? null,
    blockedReason: task.blockedReason ?? null,
    tags: task.tags ?? []
  };
}

function statusCounts(tasks: BoardTask[]) {
  return Object.values(ActivityStatus).reduce<Record<ActivityStatus, number>>(
    (counts, status) => {
      counts[status] = tasks.filter((task) => task.status === status).length;
      return counts;
    },
    {} as Record<ActivityStatus, number>
  );
}

function priorityCounts(tasks: BoardTask[]) {
  return Object.values(Priority).reduce<Record<Priority, number>>(
    (counts, priority) => {
      counts[priority] = tasks.filter((task) => task.priority === priority).length;
      return counts;
    },
    {} as Record<Priority, number>
  );
}

function activeTask(task: BoardTask) {
  return task.status !== ActivityStatus.DONE && task.status !== ActivityStatus.CANCELED;
}

export function buildProjectStatusReport(input: {
  tenantId: string;
  projectId: string;
  grouped: unknown;
  dueSoonDays?: number;
}) {
  const dueSoonDays = input.dueSoonDays ?? 7;
  const tasks = flattenGroupedTasks(input.grouped);
  const activeTasks = tasks.filter(activeTask);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dueSoonLimit = new Date(today);
  dueSoonLimit.setDate(today.getDate() + dueSoonDays);
  dueSoonLimit.setHours(23, 59, 59, 999);

  const overdueTasks = activeTasks.filter((task) => {
    const dueDate = parseTaskDate(task.dueDate);
    return dueDate ? dueDate < today : false;
  });

  const dueSoonTasks = activeTasks.filter((task) => {
    const dueDate = parseTaskDate(task.dueDate);
    return dueDate ? dueDate >= today && dueDate <= dueSoonLimit : false;
  });

  const blockers = tasks.filter((task) => task.status === ActivityStatus.BLOCKED);
  const completed = tasks.filter((task) => task.status === ActivityStatus.DONE);
  const canceled = tasks.filter((task) => task.status === ActivityStatus.CANCELED);
  const countsByStatus = statusCounts(tasks);

  return {
    tenantId: input.tenantId,
    projectId: input.projectId,
    generatedAt: new Date().toISOString(),
    totalActivities: tasks.length,
    backlog: countsByStatus.BACKLOG,
    todo: countsByStatus.TODO,
    inProgress: countsByStatus.IN_PROGRESS,
    blocked: countsByStatus.BLOCKED,
    inReview: countsByStatus.IN_REVIEW,
    completed: countsByStatus.DONE,
    canceled: countsByStatus.CANCELED,
    overdue: overdueTasks.length,
    dueSoon: dueSoonTasks.length,
    totalTasks: tasks.length,
    activeTasks: activeTasks.length,
    completedTasks: completed.length,
    canceledTasks: canceled.length,
    completionRate: tasks.length === 0 ? 0 : Number(((completed.length / tasks.length) * 100).toFixed(2)),
    countsByStatus,
    countsByPriority: priorityCounts(tasks),
    overdueDetails: {
      count: overdueTasks.length,
      tasks: overdueTasks.map(taskSummary)
    },
    dueSoonDetails: {
      days: dueSoonDays,
      count: dueSoonTasks.length,
      tasks: dueSoonTasks.map(taskSummary)
    },
    blockers: {
      count: blockers.length,
      tasks: blockers.map(taskSummary)
    }
  };
}

export { activeTask, taskSummary };
