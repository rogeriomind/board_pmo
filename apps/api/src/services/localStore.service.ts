import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { ActivityStatus, Priority } from "@prisma/client";
import { HttpError } from "../utils/httpError.js";

type LocalUser = {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

type LocalTag = {
  id: string;
  name: string;
  color: string;
  createdAt: string;
};

type LocalActivity = {
  id: string;
  title: string;
  description: string | null;
  status: ActivityStatus;
  priority: Priority;
  assigneeId: string | null;
  dueDate: string | null;
  completedAt: string | null;
  blockedReason: string | null;
  canceledReason: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
};

type LocalChecklistItem = {
  id: string;
  activityId: string;
  title: string;
  isDone: boolean;
  createdAt: string;
  updatedAt: string;
};

type LocalComment = {
  id: string;
  activityId: string;
  userId: string;
  message: string;
  createdAt: string;
};

type LocalAttachment = {
  id: string;
  activityId: string;
  fileName: string;
  fileUrl: string;
  fileType: string;
  createdAt: string;
};

type LocalHistory = {
  id: string;
  activityId: string;
  userId: string;
  action: string;
  fieldChanged: string | null;
  oldValue: string | null;
  newValue: string | null;
  createdAt: string;
};

type LocalStore = {
  users: LocalUser[];
  tags: LocalTag[];
  activities: LocalActivity[];
  activityTags: Array<{ activityId: string; tagId: string }>;
  checklistItems: LocalChecklistItem[];
  comments: LocalComment[];
  attachments: LocalAttachment[];
  history: LocalHistory[];
};

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(currentDir, "../../data");
const dataFile = path.join(dataDir, "local-store.json");
const statuses = Object.values(ActivityStatus);
const tagPalette = ["#6d5dfc", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#14b8a6"];

function now() {
  return new Date().toISOString();
}

function day(value: string) {
  return new Date(`${value}T12:00:00.000Z`).toISOString();
}

function publicUser(user?: LocalUser | null) {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    avatarUrl: user.avatarUrl
  };
}

function normalizeList(values?: string[]) {
  return [...new Set((values ?? []).map((value) => value.trim()).filter(Boolean))];
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

function emptyGroups() {
  return statuses.reduce<Record<ActivityStatus, ReturnType<typeof serializeActivity>[]>>(
    (groups, status) => {
      groups[status] = [];
      return groups;
    },
    {} as Record<ActivityStatus, ReturnType<typeof serializeActivity>[]>
  );
}

async function createSeed(): Promise<LocalStore> {
  const timestamp = now();
  const passwordHash = await bcrypt.hash("123456", 10);
  const users: LocalUser[] = [
    ["Rogerio", "rogerio@pmo.local"],
    ["Ana", "ana@pmo.local"],
    ["Matheus", "matheus@pmo.local"],
    ["Gabrielle", "gabrielle@pmo.local"]
  ].map(([name, email]) => ({
    id: randomUUID(),
    name,
    email,
    passwordHash,
    avatarUrl: `https://api.dicebear.com/9.x/avataaars/svg?seed=${name}`,
    createdAt: timestamp,
    updatedAt: timestamp
  }));

  const tags: LocalTag[] = [
    ["Automacao", "#6d5dfc"],
    ["WhatsApp", "#10b981"],
    ["Comunicacao", "#0ea5e9"],
    ["Financeiro", "#f59e0b"],
    ["Dados", "#ef4444"],
    ["UX", "#8b5cf6"],
    ["Seguranca", "#14b8a6"]
  ].map(([name, color]) => ({ id: randomUUID(), name, color, createdAt: timestamp }));

  const [rogerio, ana, matheus, gabrielle] = users;
  const activityTags: LocalStore["activityTags"] = [];
  const checklistItems: LocalChecklistItem[] = [];
  const history: LocalHistory[] = [];

  const activities: LocalActivity[] = [
    {
      title: "Configurar lembrete automatico",
      description: "Configurar lembrete automatico de atualizacao de atividades via WhatsApp e e-mail.",
      status: ActivityStatus.TODO,
      priority: Priority.HIGH,
      assigneeId: rogerio.id,
      dueDate: day("2026-07-10"),
      tags: ["Automacao", "WhatsApp", "Comunicacao"],
      checklist: [
        ["Mapear fluxo atual", true],
        ["Definir regras de lembrete", true],
        ["Configurar templates de mensagem", false],
        ["Testes e validacao", false]
      ]
    },
    {
      title: "Desenvolver modulo de cobranca",
      description: "Entregar rotina de cobranca com retentativas e trilha de auditoria.",
      status: ActivityStatus.IN_PROGRESS,
      priority: Priority.HIGH,
      assigneeId: ana.id,
      dueDate: day("2026-07-03"),
      tags: ["Financeiro", "Automacao"],
      checklist: [
        ["Modelar eventos de cobranca", true],
        ["Implementar endpoint de retentativa", false],
        ["Criar painel de acompanhamento", false]
      ]
    },
    {
      title: "Encontro de dados com CRM",
      description: "Validar contrato de integracao com CRM e alinhar dependencia externa.",
      status: ActivityStatus.BLOCKED,
      priority: Priority.HIGH,
      assigneeId: matheus.id,
      dueDate: day("2026-06-25"),
      blockedReason: "Dependencia externa",
      tags: ["Dados", "Comunicacao"],
      checklist: [
        ["Confirmar campos obrigatorios", true],
        ["Receber payload atualizado", false]
      ]
    },
    {
      title: "Testes de usabilidade",
      description: "Rodar testes guiados com usuarios internos e consolidar aprendizados.",
      status: ActivityStatus.IN_REVIEW,
      priority: Priority.MEDIUM,
      assigneeId: gabrielle.id,
      dueDate: day("2026-07-02"),
      tags: ["UX"],
      checklist: [
        ["Preparar roteiro", true],
        ["Conduzir sessoes", true],
        ["Validar ajustes finais", false]
      ]
    },
    {
      title: "Login com autenticacao 2FA",
      description: "Concluir autenticacao de dois fatores para usuarios administrativos.",
      status: ActivityStatus.DONE,
      priority: Priority.LOW,
      assigneeId: rogerio.id,
      dueDate: day("2026-06-16"),
      completedAt: "2026-06-16T18:30:00.000Z",
      tags: ["Seguranca"],
      checklist: [
        ["Gerar token temporario", true],
        ["Validar QR code", true],
        ["Registrar auditoria", true]
      ]
    }
  ].map((input) => {
    const id = randomUUID();
    for (const tagName of input.tags) {
      const tag = tags.find((item) => item.name === tagName);
      if (tag) activityTags.push({ activityId: id, tagId: tag.id });
    }
    for (const item of input.checklist) {
      const title = String(item[0]);
      const isDone = Boolean(item[1]);
      checklistItems.push({
        id: randomUUID(),
        activityId: id,
        title,
        isDone,
        createdAt: timestamp,
        updatedAt: timestamp
      });
    }
    history.push({
      id: randomUUID(),
      activityId: id,
      userId: rogerio.id,
      action: "Atividade criada",
      fieldChanged: null,
      oldValue: null,
      newValue: null,
      createdAt: timestamp
    });
    return {
      id,
      title: input.title,
      description: input.description,
      status: input.status,
      priority: input.priority,
      assigneeId: input.assigneeId,
      dueDate: input.dueDate,
      completedAt: input.completedAt ?? null,
      blockedReason: input.blockedReason ?? null,
      canceledReason: null,
      createdById: rogerio.id,
      createdAt: timestamp,
      updatedAt: timestamp
    };
  });

  const comments: LocalComment[] = [
    {
      id: randomUUID(),
      activityId: activities[0].id,
      userId: ana.id,
      message: "Podemos reaproveitar os templates do fluxo de cobranca.",
      createdAt: timestamp
    },
    {
      id: randomUUID(),
      activityId: activities[2].id,
      userId: matheus.id,
      message: "Aguardando retorno do fornecedor do CRM.",
      createdAt: timestamp
    }
  ];

  return { users, tags, activities, activityTags, checklistItems, comments, attachments: [], history };
}

async function readStore() {
  try {
    const raw = await fs.readFile(dataFile, "utf8");
    return JSON.parse(raw) as LocalStore;
  } catch {
    const store = await createSeed();
    await writeStore(store);
    return store;
  }
}

async function writeStore(store: LocalStore) {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(dataFile, JSON.stringify(store, null, 2));
}

function serializeActivity(activity: LocalActivity, store: LocalStore, includeDetail = false) {
  const assignee = store.users.find((user) => user.id === activity.assigneeId);
  const createdBy = store.users.find((user) => user.id === activity.createdById);
  const tagIds = store.activityTags.filter((item) => item.activityId === activity.id).map((item) => item.tagId);
  const tags = store.tags.filter((tag) => tagIds.includes(tag.id));
  const checklist = store.checklistItems
    .filter((item) => item.activityId === activity.id)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  const base = {
    ...activity,
    assignee: publicUser(assignee),
    createdBy: publicUser(createdBy),
    tags,
    checklist,
    attachments: store.attachments.filter((item) => item.activityId === activity.id)
  };

  if (!includeDetail) return base;

  return {
    ...base,
    comments: store.comments
      .filter((comment) => comment.activityId === activity.id)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map((comment) => ({
        ...comment,
        user: publicUser(store.users.find((user) => user.id === comment.userId))
      })),
    history: store.history
      .filter((item) => item.activityId === activity.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((item) => ({
        ...item,
        user: publicUser(store.users.find((user) => user.id === item.userId))
      }))
  };
}

function findActivity(store: LocalStore, id: string) {
  const activity = store.activities.find((item) => item.id === id);
  if (!activity) throw new HttpError(404, "Atividade nao encontrada.");
  return activity;
}

function addHistory(
  store: LocalStore,
  activityId: string,
  userId: string,
  action: string,
  fieldChanged?: string,
  oldValue?: string | null,
  newValue?: string | null
) {
  store.history.push({
    id: randomUUID(),
    activityId,
    userId,
    action,
    fieldChanged: fieldChanged ?? null,
    oldValue: oldValue ?? null,
    newValue: newValue ?? null,
    createdAt: now()
  });
}

function ensureTags(store: LocalStore, names: string[]) {
  const uniqueNames = normalizeList(names);
  return uniqueNames.map((name) => {
    const existing = store.tags.find((tag) => tag.name.toLowerCase() === name.toLowerCase());
    if (existing) return existing;
    const tag = {
      id: randomUUID(),
      name,
      color: tagPalette[store.tags.length % tagPalette.length],
      createdAt: now()
    };
    store.tags.push(tag);
    return tag;
  });
}

export async function findLocalUserByEmail(email: string) {
  const store = await readStore();
  return store.users.find((user) => user.email.toLowerCase() === email.toLowerCase()) ?? null;
}

export async function listLocalUsers() {
  const store = await readStore();
  return store.users.map(publicUser).filter(Boolean);
}

export async function listLocalActivities(filters: {
  status?: ActivityStatus;
  assigneeId?: string;
  priority?: Priority;
  search?: string;
  dueDateFrom?: string;
  dueDateTo?: string;
}) {
  const store = await readStore();
  const grouped = emptyGroups();
  const search = filters.search?.toLowerCase();

  for (const activity of store.activities) {
    const matches =
      (!filters.status || activity.status === filters.status) &&
      (!filters.assigneeId || activity.assigneeId === filters.assigneeId) &&
      (!filters.priority || activity.priority === filters.priority) &&
      (!search ||
        activity.title.toLowerCase().includes(search) ||
        activity.description?.toLowerCase().includes(search)) &&
      (!filters.dueDateFrom || (activity.dueDate && activity.dueDate >= day(filters.dueDateFrom))) &&
      (!filters.dueDateTo || (activity.dueDate && activity.dueDate <= day(filters.dueDateTo)));

    if (matches) {
      grouped[activity.status].push(serializeActivity(activity, store));
    }
  }

  for (const status of statuses) {
    grouped[status].sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""));
  }

  return grouped;
}

export async function getLocalActivityById(id: string) {
  const store = await readStore();
  return serializeActivity(findActivity(store, id), store, true);
}

export async function createLocalActivity(
  userId: string,
  data: {
    title: string;
    description?: string | null;
    status: ActivityStatus;
    priority: Priority;
    assigneeId?: string | null;
    dueDate?: string | null;
    tags?: string[];
    checklist?: string[];
  }
) {
  const store = await readStore();
  const timestamp = now();
  const activity: LocalActivity = {
    id: randomUUID(),
    title: data.title,
    description: data.description || null,
    status: data.status,
    priority: data.priority,
    assigneeId: data.assigneeId || null,
    dueDate: data.dueDate ? day(data.dueDate) : null,
    completedAt: null,
    blockedReason: null,
    canceledReason: null,
    createdById: userId,
    createdAt: timestamp,
    updatedAt: timestamp
  };

  store.activities.push(activity);
  for (const tag of ensureTags(store, data.tags ?? [])) {
    store.activityTags.push({ activityId: activity.id, tagId: tag.id });
  }
  for (const title of normalizeList(data.checklist)) {
    store.checklistItems.push({
      id: randomUUID(),
      activityId: activity.id,
      title,
      isDone: false,
      createdAt: timestamp,
      updatedAt: timestamp
    });
  }
  addHistory(store, activity.id, userId, "Atividade criada");
  await writeStore(store);
  return getLocalActivityById(activity.id);
}

export async function updateLocalActivity(
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
  }
) {
  const store = await readStore();
  const activity = findActivity(store, id);
  const timestamp = now();

  if (data.title !== undefined && data.title !== activity.title) {
    addHistory(store, id, userId, "Atividade atualizada", "titulo", activity.title, data.title);
    activity.title = data.title;
  }
  if (data.description !== undefined && (data.description || null) !== activity.description) {
    addHistory(store, id, userId, "Atividade atualizada", "descricao", activity.description, data.description || null);
    activity.description = data.description || null;
  }
  if (data.priority !== undefined && data.priority !== activity.priority) {
    addHistory(
      store,
      id,
      userId,
      "Atividade atualizada",
      "prioridade",
      readablePriority(activity.priority),
      readablePriority(data.priority)
    );
    activity.priority = data.priority;
  }
  if (data.assigneeId !== undefined && (data.assigneeId || null) !== activity.assigneeId) {
    const oldUser = store.users.find((item) => item.id === activity.assigneeId)?.name ?? "Sem responsavel";
    const newUser = store.users.find((item) => item.id === data.assigneeId)?.name ?? "Sem responsavel";
    addHistory(store, id, userId, "Atividade atualizada", "responsavel", oldUser, newUser);
    activity.assigneeId = data.assigneeId || null;
  }
  if (data.dueDate !== undefined && (data.dueDate ? day(data.dueDate) : null) !== activity.dueDate) {
    addHistory(
      store,
      id,
      userId,
      "Atividade atualizada",
      "prazo",
      activity.dueDate?.slice(0, 10) ?? "",
      data.dueDate ?? ""
    );
    activity.dueDate = data.dueDate ? day(data.dueDate) : null;
  }
  if (data.tags !== undefined) {
    const oldTags = store.activityTags
      .filter((item) => item.activityId === id)
      .map((item) => store.tags.find((tag) => tag.id === item.tagId)?.name)
      .filter(Boolean)
      .sort()
      .join(", ");
    const newTags = normalizeList(data.tags).sort().join(", ");
    if (oldTags !== newTags) {
      store.activityTags = store.activityTags.filter((item) => item.activityId !== id);
      for (const tag of ensureTags(store, data.tags)) {
        store.activityTags.push({ activityId: id, tagId: tag.id });
      }
      addHistory(store, id, userId, "Atividade atualizada", "tags", oldTags, newTags);
    }
  }
  if (data.checklist !== undefined) {
    const oldChecklist = store.checklistItems
      .filter((item) => item.activityId === id)
      .map((item) => item.title)
      .join(" | ");
    const newChecklist = normalizeList(data.checklist).join(" | ");
    if (oldChecklist !== newChecklist) {
      store.checklistItems = store.checklistItems.filter((item) => item.activityId !== id);
      for (const title of normalizeList(data.checklist)) {
        store.checklistItems.push({
          id: randomUUID(),
          activityId: id,
          title,
          isDone: false,
          createdAt: timestamp,
          updatedAt: timestamp
        });
      }
      addHistory(store, id, userId, "Atividade atualizada", "checklist", oldChecklist, newChecklist);
    }
  }

  activity.updatedAt = timestamp;
  await writeStore(store);
  return getLocalActivityById(id);
}

export async function moveLocalActivity(id: string, userId: string, status: ActivityStatus, reason?: string) {
  const store = await readStore();
  const activity = findActivity(store, id);
  const checklist = store.checklistItems.filter((item) => item.activityId === id);

  if (status === ActivityStatus.IN_PROGRESS && !activity.assigneeId) {
    throw new HttpError(422, "Defina um responsavel antes de mover para Em Andamento.");
  }
  if (status === ActivityStatus.IN_REVIEW && !activity.description?.trim()) {
    throw new HttpError(422, "Preencha a descricao antes de mover para Em Validacao.");
  }
  if (status === ActivityStatus.DONE) {
    if (!activity.assigneeId) throw new HttpError(422, "Defina um responsavel antes de concluir a atividade.");
    if (!activity.description?.trim()) throw new HttpError(422, "Preencha a descricao antes de concluir a atividade.");
    if (checklist.length === 0 || checklist.some((item) => !item.isDone)) {
      throw new HttpError(422, "Complete todos os itens do checklist antes de concluir.");
    }
  }
  if (status === ActivityStatus.BLOCKED && !reason?.trim()) {
    throw new HttpError(422, "Informe o motivo do bloqueio.");
  }
  if (status === ActivityStatus.CANCELED && !reason?.trim()) {
    throw new HttpError(422, "Informe o motivo do cancelamento.");
  }

  const oldStatus = activity.status;
  activity.status = status;
  activity.completedAt = status === ActivityStatus.DONE ? now() : null;
  activity.blockedReason = status === ActivityStatus.BLOCKED ? reason?.trim() ?? null : null;
  activity.canceledReason = status === ActivityStatus.CANCELED ? reason?.trim() ?? null : null;
  activity.updatedAt = now();
  addHistory(
    store,
    id,
    userId,
    status === ActivityStatus.DONE
      ? "Atividade concluida"
      : `Status alterado de ${readableStatus(oldStatus)} para ${readableStatus(status)}`,
    "status",
    readableStatus(oldStatus),
    readableStatus(status)
  );

  await writeStore(store);
  return getLocalActivityById(id);
}

export async function cancelLocalActivity(id: string, userId: string, reason = "Cancelada pelo usuario") {
  return moveLocalActivity(id, userId, ActivityStatus.CANCELED, reason);
}

export async function addLocalChecklistItem(activityId: string, userId: string, title: string) {
  const store = await readStore();
  findActivity(store, activityId);
  const item: LocalChecklistItem = {
    id: randomUUID(),
    activityId,
    title,
    isDone: false,
    createdAt: now(),
    updatedAt: now()
  };
  store.checklistItems.push(item);
  addHistory(store, activityId, userId, "Item adicionado ao checklist", "checklist", null, title);
  await writeStore(store);
  return item;
}

export async function updateLocalChecklistItem(itemId: string, userId: string, data: { title?: string; isDone?: boolean }) {
  const store = await readStore();
  const item = store.checklistItems.find((current) => current.id === itemId);
  if (!item) throw new HttpError(404, "Item de checklist nao encontrado.");
  const oldTitle = item.title;
  if (data.title !== undefined) item.title = data.title;
  if (data.isDone !== undefined) item.isDone = data.isDone;
  item.updatedAt = now();
  addHistory(
    store,
    item.activityId,
    userId,
    data.isDone === undefined ? "Checklist atualizado" : data.isDone ? "Checklist marcado" : "Checklist desmarcado",
    "checklist",
    oldTitle,
    item.title
  );
  await writeStore(store);
  return item;
}

export async function deleteLocalChecklistItem(itemId: string, userId: string) {
  const store = await readStore();
  const item = store.checklistItems.find((current) => current.id === itemId);
  if (!item) throw new HttpError(404, "Item de checklist nao encontrado.");
  store.checklistItems = store.checklistItems.filter((current) => current.id !== itemId);
  addHistory(store, item.activityId, userId, "Item removido do checklist", "checklist", item.title);
  await writeStore(store);
}

export async function addLocalComment(activityId: string, userId: string, message: string) {
  const store = await readStore();
  findActivity(store, activityId);
  const comment: LocalComment = { id: randomUUID(), activityId, userId, message, createdAt: now() };
  store.comments.push(comment);
  addHistory(store, activityId, userId, "Comentario adicionado");
  await writeStore(store);
  return {
    ...comment,
    user: publicUser(store.users.find((user) => user.id === userId))
  };
}

export async function listLocalComments(activityId: string) {
  const store = await readStore();
  return store.comments
    .filter((comment) => comment.activityId === activityId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((comment) => ({
      ...comment,
      user: publicUser(store.users.find((user) => user.id === comment.userId))
    }));
}

export async function listLocalHistory(activityId: string) {
  const store = await readStore();
  return store.history
    .filter((item) => item.activityId === activityId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((item) => ({
      ...item,
      user: publicUser(store.users.find((user) => user.id === item.userId))
    }));
}

export async function listLocalAlerts() {
  const store = await readStore();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const inTwoDays = new Date(today);
  inTwoDays.setDate(today.getDate() + 2);
  inTwoDays.setHours(23, 59, 59, 999);
  const inFiveDays = new Date(today);
  inFiveDays.setDate(today.getDate() + 5);
  inFiveDays.setHours(23, 59, 59, 999);

  const active = store.activities.filter((activity) => activity.status !== ActivityStatus.DONE);
  const byDue = (a: LocalActivity, b: LocalActivity) => (a.dueDate ?? "").localeCompare(b.dueDate ?? "");
  const dueDate = (activity: LocalActivity) => (activity.dueDate ? new Date(activity.dueDate) : null);

  return {
    overdue: active
      .filter((activity) => {
        const date = dueDate(activity);
        return date && date < today;
      })
      .sort(byDue)
      .map((activity) => serializeActivity(activity, store)),
    atRisk: active
      .filter((activity) => {
        const date = dueDate(activity);
        return date && date >= today && date <= inTwoDays;
      })
      .sort(byDue)
      .map((activity) => serializeActivity(activity, store)),
    blocked: store.activities
      .filter((activity) => activity.status === ActivityStatus.BLOCKED)
      .map((activity) => serializeActivity(activity, store)),
    withoutAssignee: active
      .filter((activity) => !activity.assigneeId)
      .map((activity) => serializeActivity(activity, store)),
    nearDueDate: active
      .filter((activity) => {
        const date = dueDate(activity);
        return date && date >= today && date <= inFiveDays;
      })
      .sort(byDue)
      .map((activity) => serializeActivity(activity, store))
  };
}
