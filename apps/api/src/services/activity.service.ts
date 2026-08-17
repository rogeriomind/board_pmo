import { ActivityStatus, Prisma, Priority } from "@prisma/client";
import { withDefaultPmoScope, type PmoScope, type PmoScopeInput } from "../domain/pmoContext.js";
import { prisma } from "../lib/prisma.js";
import { HttpError } from "../utils/httpError.js";

const statuses = Object.values(ActivityStatus);

const userSelect = {
  id: true,
  name: true,
  email: true,
  avatarUrl: true
} satisfies Prisma.UserSelect;

const cardInclude = {
  assignee: { select: userSelect },
  createdBy: { select: userSelect },
  tags: { include: { tag: true } },
  checklistItems: { orderBy: { createdAt: "asc" } },
  attachments: { orderBy: { createdAt: "asc" } }
} satisfies Prisma.ActivityInclude;

const detailInclude = {
  ...cardInclude,
  comments: {
    include: { user: { select: userSelect } },
    orderBy: { createdAt: "asc" }
  },
  history: {
    include: { user: { select: userSelect } },
    orderBy: { createdAt: "desc" }
  }
} satisfies Prisma.ActivityInclude;

const tagPalette = [
  "#6d5dfc",
  "#0ea5e9",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#14b8a6"
];

type ActivityWithRelations = Prisma.ActivityGetPayload<{ include: typeof detailInclude }>;
type ActivityCardWithRelations = Prisma.ActivityGetPayload<{ include: typeof cardInclude }>;

export type ActivityFilters = PmoScopeInput & {
  status?: ActivityStatus;
  assigneeId?: string;
  priority?: Priority;
  search?: string;
  dueDateFrom?: string;
  dueDateTo?: string;
};

export type ActivityWriteOptions = {
  scope?: PmoScopeInput;
  idempotency?: {
    tenantId: string;
    key: string;
    operation: string;
  };
};

export function serializeActivity(activity: ActivityWithRelations | ActivityCardWithRelations) {
  const { tags, checklistItems, ...rest } = activity;

  return {
    ...rest,
    tags: tags.map(({ tag }) => tag),
    checklist: checklistItems
  };
}

function parseDate(value?: string | null) {
  if (!value) return null;
  return new Date(`${value}T12:00:00.000Z`);
}

function toDateInput(date?: Date | null) {
  return date ? date.toISOString().slice(0, 10) : "";
}

function normalizeList(values?: string[]) {
  return [...new Set((values ?? []).map((value) => value.trim()).filter(Boolean))];
}

function scopeFor(input?: PmoScopeInput, fallback?: PmoScopeInput) {
  return withDefaultPmoScope({
    tenantId: input?.tenantId ?? fallback?.tenantId,
    projectId: input?.projectId ?? fallback?.projectId
  });
}

function scopedActivityWhere(id: string, scope: PmoScope): Prisma.ActivityWhereInput {
  return {
    id,
    tenantId: scope.tenantId,
    projectId: scope.projectId
  };
}

function scopedActivityOnlyWhere(scope: PmoScope): Prisma.ActivityWhereInput {
  return {
    tenantId: scope.tenantId,
    projectId: scope.projectId
  };
}

function normalizeWriteOptions(options: ActivityWriteOptions | undefined, scope: PmoScope) {
  if (options?.idempotency && options.idempotency.tenantId !== scope.tenantId) {
    throw new HttpError(400, "tenantId da idempotencia diverge do tenantId da operacao.");
  }

  return {
    scope,
    idempotency: options?.idempotency
  };
}

function asJsonPayload<T>(result: T) {
  return JSON.parse(JSON.stringify(result)) as Prisma.InputJsonValue;
}

function isUniqueConstraint(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

async function runWrite<T>(
  options: ReturnType<typeof normalizeWriteOptions>,
  handler: (client: Prisma.TransactionClient) => Promise<{ result: T; resourceId?: string | null }>
) {
  const { idempotency } = options;

  if (!idempotency) {
    const value = await prisma.$transaction(handler);
    return value.result;
  }

  try {
    const value = await prisma.$transaction(async (client) => {
      const existing = await client.idempotencyRecord.findUnique({
        where: {
          tenantId_key: {
            tenantId: idempotency.tenantId,
            key: idempotency.key
          }
        }
      });

      if (existing) {
        return { result: existing.responsePayload as T, resourceId: existing.resourceId };
      }

      const next = await handler(client);

      await client.idempotencyRecord.create({
        data: {
          tenantId: idempotency.tenantId,
          key: idempotency.key,
          operation: idempotency.operation,
          resourceId: next.resourceId ?? null,
          responsePayload: asJsonPayload(next.result)
        }
      });

      return next;
    });

    return value.result;
  } catch (error) {
    if (isUniqueConstraint(error)) {
      const existing = await prisma.idempotencyRecord.findUnique({
        where: {
          tenantId_key: {
            tenantId: idempotency.tenantId,
            key: idempotency.key
          }
        }
      });

      if (existing) {
        return existing.responsePayload as T;
      }
    }

    throw error;
  }
}

async function ensureProject(client: Prisma.TransactionClient, scope: PmoScope) {
  const project = await client.project.findFirst({
    where: {
      id: scope.projectId,
      tenantId: scope.tenantId,
      active: true
    },
    select: { id: true, tenantId: true }
  });

  if (!project) {
    throw new HttpError(404, "Projeto nao encontrado para o tenant informado.");
  }

  return project;
}

async function findOrCreateTags(client: Prisma.TransactionClient, names: string[]) {
  const uniqueNames = normalizeList(names);

  if (uniqueNames.length === 0) {
    return [];
  }

  const existingTags = await client.tag.findMany({
    where: { name: { in: uniqueNames } }
  });

  const missingNames = uniqueNames.filter(
    (name) => !existingTags.some((tag) => tag.name.toLowerCase() === name.toLowerCase())
  );

  const createdTags = await Promise.all(
    missingNames.map((name, index) =>
      client.tag.create({
        data: {
          name,
          color: tagPalette[(existingTags.length + index) % tagPalette.length]
        }
      })
    )
  );

  return [...existingTags, ...createdTags];
}

function readableStatus(status: ActivityStatus) {
  const labels: Record<ActivityStatus, string> = {
    BACKLOG: "Backlog",
    TODO: "A Fazer",
    IN_PROGRESS: "Em Andamento",
    BLOCKED: "Bloqueado",
    IN_REVIEW: "Em Validacao",
    DONE: "Concluido",
    CANCELED: "Cancelado"
  };

  return labels[status];
}

function readablePriority(priority: Priority) {
  const labels: Record<Priority, string> = {
    LOW: "Baixa",
    MEDIUM: "Media",
    HIGH: "Alta",
    CRITICAL: "Critica"
  };

  return labels[priority];
}

async function getSerializedActivity(client: Prisma.TransactionClient, id: string, scope: PmoScope) {
  const activity = await client.activity.findFirst({
    where: scopedActivityWhere(id, scope),
    include: detailInclude
  });

  if (!activity) {
    throw new HttpError(404, "Atividade nao encontrada.");
  }

  return serializeActivity(activity);
}

export async function listActivities(filters: ActivityFilters) {
  const scope = withDefaultPmoScope(filters);
  const where: Prisma.ActivityWhereInput = {
    tenantId: scope.tenantId,
    projectId: scope.projectId,
    status: filters.status,
    assigneeId: filters.assigneeId,
    priority: filters.priority
  };

  if (filters.search) {
    where.OR = [
      { title: { contains: filters.search, mode: "insensitive" } },
      { description: { contains: filters.search, mode: "insensitive" } }
    ];
  }

  if (filters.dueDateFrom || filters.dueDateTo) {
    const dueDate: Prisma.DateTimeFilter = {};
    const from = parseDate(filters.dueDateFrom);
    const to = parseDate(filters.dueDateTo);

    if (from) dueDate.gte = from;
    if (to) dueDate.lte = to;

    where.dueDate = dueDate;
  }

  const activities = await prisma.activity.findMany({
    where,
    include: cardInclude,
    orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }]
  });

  const grouped = statuses.reduce<Record<ActivityStatus, ReturnType<typeof serializeActivity>[]>>(
    (accumulator, status) => {
      accumulator[status] = [];
      return accumulator;
    },
    {} as Record<ActivityStatus, ReturnType<typeof serializeActivity>[]>
  );

  for (const activity of activities) {
    grouped[activity.status].push(serializeActivity(activity));
  }

  return grouped;
}

export async function getActivityById(id: string, scopeInput?: PmoScopeInput) {
  const scope = withDefaultPmoScope(scopeInput);
  const activity = await prisma.activity.findFirst({
    where: scopedActivityWhere(id, scope),
    include: detailInclude
  });

  if (!activity) {
    throw new HttpError(404, "Atividade nao encontrada.");
  }

  return serializeActivity(activity);
}

export async function createActivity(
  userId: string,
  data: {
    tenantId?: string | null;
    projectId?: string | null;
    title: string;
    description?: string | null;
    status: ActivityStatus;
    priority: Priority;
    assigneeId?: string | null;
    dueDate?: string | null;
    tags?: string[];
    checklist?: string[];
  },
  options?: ActivityWriteOptions
) {
  const scope = scopeFor(data, options?.scope);
  const writeOptions = normalizeWriteOptions(options, scope);

  return runWrite(writeOptions, async (client) => {
    await ensureProject(client, scope);
    const tags = await findOrCreateTags(client, data.tags ?? []);

    const activity = await client.activity.create({
      data: {
        tenantId: scope.tenantId,
        projectId: scope.projectId,
        title: data.title,
        description: data.description || null,
        status: data.status,
        priority: data.priority,
        assigneeId: data.assigneeId || null,
        dueDate: parseDate(data.dueDate),
        createdById: userId,
        tags: {
          create: tags.map((tag) => ({ tagId: tag.id }))
        },
        checklistItems: {
          create: normalizeList(data.checklist).map((title) => ({ title }))
        }
      }
    });

    await client.activityHistory.create({
      data: {
        activityId: activity.id,
        userId,
        action: "Atividade criada"
      }
    });

    return {
      result: await getSerializedActivity(client, activity.id, scope),
      resourceId: activity.id
    };
  });
}

export async function updateActivity(
  id: string,
  userId: string,
  data: {
    title?: string;
    description?: string | null;
    priority?: Priority;
    assigneeId?: string | null;
    dueDate?: string | null;
    tags?: string[];
    checklist?: string[];
  },
  options?: ActivityWriteOptions
) {
  const scope = scopeFor(options?.scope);
  const writeOptions = normalizeWriteOptions(options, scope);

  return runWrite(writeOptions, async (client) => {
    const current = await client.activity.findFirst({
      where: scopedActivityWhere(id, scope),
      include: {
        assignee: { select: userSelect },
        tags: { include: { tag: true } },
        checklistItems: { orderBy: { createdAt: "asc" } }
      }
    });

    if (!current) {
      throw new HttpError(404, "Atividade nao encontrada.");
    }

    const changes: Prisma.ActivityHistoryCreateManyInput[] = [];
    const updateData: Prisma.ActivityUpdateInput = {};

    if (data.title !== undefined && data.title !== current.title) {
      updateData.title = data.title;
      changes.push({ activityId: id, userId, action: "Atividade atualizada", fieldChanged: "titulo", oldValue: current.title, newValue: data.title });
    }

    if (data.description !== undefined && (data.description || null) !== current.description) {
      updateData.description = data.description || null;
      changes.push({ activityId: id, userId, action: "Atividade atualizada", fieldChanged: "descricao", oldValue: current.description, newValue: data.description || null });
    }

    if (data.priority !== undefined && data.priority !== current.priority) {
      updateData.priority = data.priority;
      changes.push({ activityId: id, userId, action: "Atividade atualizada", fieldChanged: "prioridade", oldValue: readablePriority(current.priority), newValue: readablePriority(data.priority) });
    }

    if (data.assigneeId !== undefined && (data.assigneeId || null) !== current.assigneeId) {
      updateData.assignee = data.assigneeId ? { connect: { id: data.assigneeId } } : { disconnect: true };
      changes.push({ activityId: id, userId, action: "Atividade atualizada", fieldChanged: "responsavel", oldValue: current.assignee?.name ?? "Sem responsavel", newValue: data.assigneeId ?? "Sem responsavel" });
    }

    if (data.dueDate !== undefined && parseDate(data.dueDate)?.toISOString() !== current.dueDate?.toISOString()) {
      updateData.dueDate = parseDate(data.dueDate);
      changes.push({ activityId: id, userId, action: "Atividade atualizada", fieldChanged: "prazo", oldValue: toDateInput(current.dueDate), newValue: data.dueDate ?? "" });
    }

    if (Object.keys(updateData).length > 0) {
      await client.activity.update({
        where: { id },
        data: updateData
      });
    }

    if (data.tags !== undefined) {
      const oldTags = current.tags.map(({ tag }) => tag.name).sort().join(", ");
      const newTags = normalizeList(data.tags).sort().join(", ");

      if (oldTags !== newTags) {
        const tags = await findOrCreateTags(client, data.tags);
        await client.activityTag.deleteMany({ where: { activityId: id } });
        await client.activityTag.createMany({
          data: tags.map((tag) => ({ activityId: id, tagId: tag.id })),
          skipDuplicates: true
        });
        changes.push({ activityId: id, userId, action: "Atividade atualizada", fieldChanged: "tags", oldValue: oldTags, newValue: newTags });
      }
    }

    if (data.checklist !== undefined) {
      const oldChecklist = current.checklistItems.map((item) => item.title).join(" | ");
      const newChecklist = normalizeList(data.checklist).join(" | ");

      if (oldChecklist !== newChecklist) {
        await client.checklistItem.deleteMany({ where: { activityId: id } });
        await client.checklistItem.createMany({
          data: normalizeList(data.checklist).map((title) => ({ activityId: id, title }))
        });
        changes.push({ activityId: id, userId, action: "Atividade atualizada", fieldChanged: "checklist", oldValue: oldChecklist, newValue: newChecklist });
      }
    }

    if (changes.length > 0) {
      await client.activityHistory.createMany({ data: changes });
    }

    return {
      result: await getSerializedActivity(client, id, scope),
      resourceId: id
    };
  });
}

export async function moveActivity(
  id: string,
  userId: string,
  status: ActivityStatus,
  reason?: string,
  options?: ActivityWriteOptions
) {
  const scope = scopeFor(options?.scope);
  const writeOptions = normalizeWriteOptions(options, scope);

  return runWrite(writeOptions, async (client) => {
    const current = await client.activity.findFirst({
      where: scopedActivityWhere(id, scope),
      include: { checklistItems: true }
    });

    if (!current) {
      throw new HttpError(404, "Atividade nao encontrada.");
    }

    if (status === ActivityStatus.IN_PROGRESS && !current.assigneeId) {
      throw new HttpError(422, "Defina um responsavel antes de mover para Em Andamento.");
    }

    if (status === ActivityStatus.IN_REVIEW && !current.description?.trim()) {
      throw new HttpError(422, "Preencha a descricao antes de mover para Em Validacao.");
    }

    if (status === ActivityStatus.DONE) {
      const checklistComplete =
        current.checklistItems.length > 0 && current.checklistItems.every((item) => item.isDone);

      if (!current.assigneeId) {
        throw new HttpError(422, "Defina um responsavel antes de concluir a atividade.");
      }

      if (!current.description?.trim()) {
        throw new HttpError(422, "Preencha a descricao antes de concluir a atividade.");
      }

      if (!checklistComplete) {
        throw new HttpError(422, "Complete todos os itens do checklist antes de concluir.");
      }
    }

    if (status === ActivityStatus.BLOCKED && !reason?.trim()) {
      throw new HttpError(422, "Informe o motivo do bloqueio.");
    }

    if (status === ActivityStatus.CANCELED && !reason?.trim()) {
      throw new HttpError(422, "Informe o motivo do cancelamento.");
    }

    await client.activity.update({
      where: { id },
      data: {
        status,
        completedAt: status === ActivityStatus.DONE ? new Date() : null,
        blockedReason: status === ActivityStatus.BLOCKED ? reason?.trim() : null,
        canceledReason: status === ActivityStatus.CANCELED ? reason?.trim() : null
      }
    });

    await client.activityHistory.create({
      data: {
        activityId: id,
        userId,
        action:
          status === ActivityStatus.DONE
            ? "Atividade concluida"
            : `Status alterado de ${readableStatus(current.status)} para ${readableStatus(status)}`,
        fieldChanged: "status",
        oldValue: readableStatus(current.status),
        newValue: readableStatus(status)
      }
    });

    return {
      result: await getSerializedActivity(client, id, scope),
      resourceId: id
    };
  });
}

export async function cancelActivity(id: string, userId: string, reason = "Cancelada pelo usuario", scope?: PmoScopeInput) {
  return moveActivity(id, userId, ActivityStatus.CANCELED, reason, { scope });
}

export async function addChecklistItem(activityId: string, userId: string, title: string, scopeInput?: PmoScopeInput) {
  const scope = withDefaultPmoScope(scopeInput);

  return prisma.$transaction(async (client) => {
    await getSerializedActivity(client, activityId, scope);

    const item = await client.checklistItem.create({
      data: { activityId, title }
    });

    await client.activityHistory.create({
      data: {
        activityId,
        userId,
        action: "Item adicionado ao checklist",
        fieldChanged: "checklist",
        newValue: title
      }
    });

    return item;
  });
}

export async function updateChecklistItem(itemId: string, userId: string, data: { title?: string; isDone?: boolean }, scopeInput?: PmoScopeInput) {
  const scope = withDefaultPmoScope(scopeInput);
  const current = await prisma.checklistItem.findFirst({
    where: {
      id: itemId,
      activity: { is: scopedActivityOnlyWhere(scope) }
    }
  });

  if (!current) {
    throw new HttpError(404, "Item de checklist nao encontrado.");
  }

  const updated = await prisma.checklistItem.update({
    where: { id: itemId },
    data
  });

  await prisma.activityHistory.create({
    data: {
      activityId: current.activityId,
      userId,
      action: data.isDone === undefined ? "Checklist atualizado" : data.isDone ? "Checklist marcado" : "Checklist desmarcado",
      fieldChanged: "checklist",
      oldValue: current.title,
      newValue: updated.title
    }
  });

  return updated;
}

export async function deleteChecklistItem(itemId: string, userId: string, scopeInput?: PmoScopeInput) {
  const scope = withDefaultPmoScope(scopeInput);
  const current = await prisma.checklistItem.findFirst({
    where: {
      id: itemId,
      activity: { is: scopedActivityOnlyWhere(scope) }
    }
  });

  if (!current) {
    throw new HttpError(404, "Item de checklist nao encontrado.");
  }

  await prisma.checklistItem.delete({ where: { id: itemId } });
  await prisma.activityHistory.create({
    data: {
      activityId: current.activityId,
      userId,
      action: "Item removido do checklist",
      fieldChanged: "checklist",
      oldValue: current.title
    }
  });
}

export async function addComment(
  activityId: string,
  userId: string,
  message: string,
  options?: ActivityWriteOptions
) {
  const scope = scopeFor(options?.scope);
  const writeOptions = normalizeWriteOptions(options, scope);

  return runWrite(writeOptions, async (client) => {
    await getSerializedActivity(client, activityId, scope);

    const comment = await client.comment.create({
      data: { activityId, userId, message },
      include: { user: { select: userSelect } }
    });

    await client.activityHistory.create({
      data: {
        activityId,
        userId,
        action: "Comentario adicionado"
      }
    });

    return { result: comment, resourceId: comment.id };
  });
}

export async function listComments(activityId: string, scopeInput?: PmoScopeInput) {
  const scope = withDefaultPmoScope(scopeInput);

  return prisma.comment.findMany({
    where: {
      activityId,
      activity: { is: scopedActivityWhere(activityId, scope) }
    },
    include: { user: { select: userSelect } },
    orderBy: { createdAt: "asc" }
  });
}

export async function listHistory(activityId: string, scopeInput?: PmoScopeInput) {
  const scope = withDefaultPmoScope(scopeInput);

  return prisma.activityHistory.findMany({
    where: {
      activityId,
      activity: { is: scopedActivityWhere(activityId, scope) }
    },
    include: { user: { select: userSelect } },
    orderBy: { createdAt: "desc" }
  });
}

export async function listAlerts(scopeInput?: PmoScopeInput) {
  const scope = withDefaultPmoScope(scopeInput);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const inTwoDays = new Date(today);
  inTwoDays.setDate(today.getDate() + 2);
  inTwoDays.setHours(23, 59, 59, 999);

  const inFiveDays = new Date(today);
  inFiveDays.setDate(today.getDate() + 5);
  inFiveDays.setHours(23, 59, 59, 999);

  const baseWhere = {
    tenantId: scope.tenantId,
    projectId: scope.projectId
  };

  const [overdue, atRisk, blocked, withoutAssignee, nearDueDate] = await Promise.all([
    prisma.activity.findMany({
      where: { ...baseWhere, dueDate: { lt: today }, status: { not: ActivityStatus.DONE } },
      include: cardInclude,
      orderBy: { dueDate: "asc" }
    }),
    prisma.activity.findMany({
      where: { ...baseWhere, dueDate: { gte: today, lte: inTwoDays }, status: { not: ActivityStatus.DONE } },
      include: cardInclude,
      orderBy: { dueDate: "asc" }
    }),
    prisma.activity.findMany({
      where: { ...baseWhere, status: ActivityStatus.BLOCKED },
      include: cardInclude,
      orderBy: { updatedAt: "desc" }
    }),
    prisma.activity.findMany({
      where: { ...baseWhere, assigneeId: null, status: { not: ActivityStatus.DONE } },
      include: cardInclude,
      orderBy: { createdAt: "desc" }
    }),
    prisma.activity.findMany({
      where: { ...baseWhere, dueDate: { gte: today, lte: inFiveDays }, status: { not: ActivityStatus.DONE } },
      include: cardInclude,
      orderBy: { dueDate: "asc" }
    })
  ]);

  return {
    overdue: overdue.map(serializeActivity),
    atRisk: atRisk.map(serializeActivity),
    blocked: blocked.map(serializeActivity),
    withoutAssignee: withoutAssignee.map(serializeActivity),
    nearDueDate: nearDueDate.map(serializeActivity)
  };
}
