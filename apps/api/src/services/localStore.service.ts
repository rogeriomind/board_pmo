import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { ActivityStatus, Priority } from "@prisma/client";
import {
  DEFAULT_PORTFOLIO_ID,
  DEFAULT_PORTFOLIO_NAME,
  DEFAULT_PROJECT_ID,
  DEFAULT_PROJECT_NAME,
  DEFAULT_TENANT_ID,
  DEFAULT_TENANT_NAME,
  DEFAULT_TENANT_SLUG,
  withDefaultPmoScope,
  type PmoScope,
  type PmoScopeInput
} from "../domain/pmoContext.js";
import { HttpError } from "../utils/httpError.js";

type LocalTenant = {
  id: string;
  name: string;
  slug: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

type LocalPortfolio = {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

type LocalProject = {
  id: string;
  tenantId: string;
  portfolioId: string;
  name: string;
  description: string | null;
  status: string;
  health: string | null;
  startDate: string | null;
  targetDate: string | null;
  ownerId: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

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
  tenantId: string;
  projectId: string;
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

type LocalIdempotencyRecord = {
  id: string;
  tenantId: string;
  key: string;
  operation: string;
  resourceId: string | null;
  responsePayload: unknown;
  createdAt: string;
};

type LocalStore = {
  tenants: LocalTenant[];
  portfolios: LocalPortfolio[];
  projects: LocalProject[];
  users: LocalUser[];
  tags: LocalTag[];
  activities: LocalActivity[];
  activityTags: Array<{ activityId: string; tagId: string }>;
  checklistItems: LocalChecklistItem[];
  comments: LocalComment[];
  attachments: LocalAttachment[];
  history: LocalHistory[];
  idempotencyRecords: LocalIdempotencyRecord[];
};

type LocalWriteOptions = {
  scope?: PmoScopeInput;
  idempotency?: {
    tenantId: string;
    key: string;
    operation: string;
  };
};

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(currentDir, "../../data");
const dataFile = process.env.LOCAL_STORE_FILE
  ? path.resolve(process.env.LOCAL_STORE_FILE)
  : path.join(dataDir, "local-store.json");
const statuses = Object.values(ActivityStatus);
const tagPalette = ["#6d5dfc", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#14b8a6"];

function now() {
  return new Date().toISOString();
}

function day(value: string) {
  return new Date(`${value}T12:00:00.000Z`).toISOString();
}

function defaultTenant(timestamp: string): LocalTenant {
  return {
    id: DEFAULT_TENANT_ID,
    name: DEFAULT_TENANT_NAME,
    slug: DEFAULT_TENANT_SLUG,
    active: true,
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

function defaultPortfolio(timestamp: string): LocalPortfolio {
  return {
    id: DEFAULT_PORTFOLIO_ID,
    tenantId: DEFAULT_TENANT_ID,
    name: DEFAULT_PORTFOLIO_NAME,
    description: "Portfolio default para compatibilidade com atividades existentes.",
    active: true,
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

function defaultProject(timestamp: string, ownerId?: string | null): LocalProject {
  return {
    id: DEFAULT_PROJECT_ID,
    tenantId: DEFAULT_TENANT_ID,
    portfolioId: DEFAULT_PORTFOLIO_ID,
    name: DEFAULT_PROJECT_NAME,
    description: "Projeto default para compatibilidade com atividades existentes.",
    status: "ACTIVE",
    health: null,
    startDate: null,
    targetDate: null,
    ownerId: ownerId ?? null,
    active: true,
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

function ensureLocalDomain(store: Partial<LocalStore>): LocalStore {
  const timestamp = now();
  const users = store.users ?? [];
  const tenants = store.tenants?.length ? store.tenants : [defaultTenant(timestamp)];
  const portfolios = store.portfolios?.length ? store.portfolios : [defaultPortfolio(timestamp)];
  const projects = store.projects?.length ? store.projects : [defaultProject(timestamp, users[0]?.id ?? null)];

  return {
    tenants,
    portfolios,
    projects,
    users,
    tags: store.tags ?? [],
    activities: (store.activities ?? []).map((activity) => ({
      ...activity,
      tenantId: activity.tenantId ?? DEFAULT_TENANT_ID,
      projectId: activity.projectId ?? DEFAULT_PROJECT_ID
    })),
    activityTags: store.activityTags ?? [],
    checklistItems: store.checklistItems ?? [],
    comments: store.comments ?? [],
    attachments: store.attachments ?? [],
    history: store.history ?? [],
    idempotencyRecords: store.idempotencyRecords ?? []
  };
}

function ensureProject(store: LocalStore, scope: PmoScope) {
  const project = store.projects.find(
    (item) => item.id === scope.projectId && item.tenantId === scope.tenantId && item.active
  );

  if (!project) {
    throw new HttpError(404, "Projeto nao encontrado para o tenant informado.");
  }

  return project;
}

function normalizeWriteOptions(options: LocalWriteOptions | undefined, scope: PmoScope) {
  if (options?.idempotency && options.idempotency.tenantId !== scope.tenantId) {
    throw new HttpError(400, "tenantId da idempotencia diverge do tenantId da operacao.");
  }

  return options;
}

function readIdempotency(store: LocalStore, options?: LocalWriteOptions) {
  const idempotency = options?.idempotency;
  if (!idempotency) return null;

  return (
    store.idempotencyRecords.find(
      (record) => record.tenantId === idempotency.tenantId && record.key === idempotency.key
    ) ?? null
  );
}

function writeIdempotency(
  store: LocalStore,
  options: LocalWriteOptions | undefined,
  resourceId: string | null,
  responsePayload: unknown
) {
  const idempotency = options?.idempotency;
  if (!idempotency) return;

  store.idempotencyRecords.push({
    id: randomUUID(),
    tenantId: idempotency.tenantId,
    key: idempotency.key,
    operation: idempotency.operation,
    resourceId,
    responsePayload,
    createdAt: now()
  });
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
  const tenants = [defaultTenant(timestamp)];
  const portfolios = [defaultPortfolio(timestamp)];
  const projects = [defaultProject(timestamp, rogerio.id)];
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
      tenantId: DEFAULT_TENANT_ID,
      projectId: DEFAULT_PROJECT_ID,
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

  return {
    tenants,
    portfolios,
    projects,
    users,
    tags,
    activities,
    activityTags,
    checklistItems,
    comments,
    attachments: [],
    history,
    idempotencyRecords: []
  };
}

async function readStore() {
  try {
    const raw = await fs.readFile(dataFile, "utf8");
    const store = ensureLocalDomain(JSON.parse(raw) as Partial<LocalStore>);
    await writeStore(store);
    return store;
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

function findActivity(store: LocalStore, id: string, scopeInput?: PmoScopeInput) {
  const scope = withDefaultPmoScope(scopeInput);
  const activity = store.activities.find(
    (item) => item.id === id && item.tenantId === scope.tenantId && item.projectId === scope.projectId
  );
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
  tenantId?: string | null;
  projectId?: string | null;
  status?: ActivityStatus;
  assigneeId?: string;
  priority?: Priority;
  search?: string;
  dueDateFrom?: string;
  dueDateTo?: string;
}) {
  const store = await readStore();
  const scope = withDefaultPmoScope(filters);
  const grouped = emptyGroups();
  const search = filters.search?.toLowerCase();

  for (const activity of store.activities) {
    const matches =
      activity.tenantId === scope.tenantId &&
      activity.projectId === scope.projectId &&
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

export async function getLocalActivityById(id: string, scopeInput?: PmoScopeInput) {
  const store = await readStore();
  return serializeActivity(findActivity(store, id, scopeInput), store, true);
}

export async function createLocalActivity(
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
  options?: LocalWriteOptions
) {
  const store = await readStore();
  const scope = withDefaultPmoScope({
    tenantId: data.tenantId ?? options?.scope?.tenantId,
    projectId: data.projectId ?? options?.scope?.projectId
  });
  normalizeWriteOptions(options, scope);

  const existing = readIdempotency(store, options);
  if (existing) return existing.responsePayload;

  ensureProject(store, scope);
  const timestamp = now();
  const activity: LocalActivity = {
    id: randomUUID(),
    tenantId: scope.tenantId,
    projectId: scope.projectId,
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
  const response = serializeActivity(activity, store, true);
  writeIdempotency(store, options, activity.id, response);
  await writeStore(store);
  return response;
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
  },
  options?: LocalWriteOptions
) {
  const store = await readStore();
  const scope = withDefaultPmoScope(options?.scope);
  normalizeWriteOptions(options, scope);

  const existing = readIdempotency(store, options);
  if (existing) return existing.responsePayload;

  const activity = findActivity(store, id, scope);
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
  const response = serializeActivity(activity, store, true);
  writeIdempotency(store, options, id, response);
  await writeStore(store);
  return response;
}

export async function moveLocalActivity(
  id: string,
  userId: string,
  status: ActivityStatus,
  reason?: string,
  options?: LocalWriteOptions
) {
  const store = await readStore();
  const scope = withDefaultPmoScope(options?.scope);
  normalizeWriteOptions(options, scope);

  const existing = readIdempotency(store, options);
  if (existing) return existing.responsePayload;

  const activity = findActivity(store, id, scope);
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

  const response = serializeActivity(activity, store, true);
  writeIdempotency(store, options, id, response);
  await writeStore(store);
  return response;
}

export async function cancelLocalActivity(id: string, userId: string, reason = "Cancelada pelo usuario", scope?: PmoScopeInput) {
  return moveLocalActivity(id, userId, ActivityStatus.CANCELED, reason, { scope });
}

export async function addLocalChecklistItem(activityId: string, userId: string, title: string, scopeInput?: PmoScopeInput) {
  const store = await readStore();
  findActivity(store, activityId, scopeInput);
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

export async function updateLocalChecklistItem(
  itemId: string,
  userId: string,
  data: { title?: string; isDone?: boolean },
  scopeInput?: PmoScopeInput
) {
  const store = await readStore();
  const scope = withDefaultPmoScope(scopeInput);
  const item = store.checklistItems.find((current) => current.id === itemId);
  if (!item) throw new HttpError(404, "Item de checklist nao encontrado.");
  findActivity(store, item.activityId, scope);
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

export async function deleteLocalChecklistItem(itemId: string, userId: string, scopeInput?: PmoScopeInput) {
  const store = await readStore();
  const scope = withDefaultPmoScope(scopeInput);
  const item = store.checklistItems.find((current) => current.id === itemId);
  if (!item) throw new HttpError(404, "Item de checklist nao encontrado.");
  findActivity(store, item.activityId, scope);
  store.checklistItems = store.checklistItems.filter((current) => current.id !== itemId);
  addHistory(store, item.activityId, userId, "Item removido do checklist", "checklist", item.title);
  await writeStore(store);
}

export async function addLocalComment(
  activityId: string,
  userId: string,
  message: string,
  options?: LocalWriteOptions
) {
  const store = await readStore();
  const scope = withDefaultPmoScope(options?.scope);
  normalizeWriteOptions(options, scope);

  const existing = readIdempotency(store, options);
  if (existing) return existing.responsePayload;

  findActivity(store, activityId, scope);
  const comment: LocalComment = { id: randomUUID(), activityId, userId, message, createdAt: now() };
  store.comments.push(comment);
  addHistory(store, activityId, userId, "Comentario adicionado");
  const response = {
    ...comment,
    user: publicUser(store.users.find((user) => user.id === userId))
  };
  writeIdempotency(store, options, comment.id, response);
  await writeStore(store);
  return response;
}

export async function listLocalComments(activityId: string, scopeInput?: PmoScopeInput) {
  const store = await readStore();
  findActivity(store, activityId, scopeInput);
  return store.comments
    .filter((comment) => comment.activityId === activityId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((comment) => ({
      ...comment,
      user: publicUser(store.users.find((user) => user.id === comment.userId))
    }));
}

export async function listLocalHistory(activityId: string, scopeInput?: PmoScopeInput) {
  const store = await readStore();
  findActivity(store, activityId, scopeInput);
  return store.history
    .filter((item) => item.activityId === activityId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((item) => ({
      ...item,
      user: publicUser(store.users.find((user) => user.id === item.userId))
    }));
}

export async function listLocalAlerts(scopeInput?: PmoScopeInput) {
  const store = await readStore();
  const scope = withDefaultPmoScope(scopeInput);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const inTwoDays = new Date(today);
  inTwoDays.setDate(today.getDate() + 2);
  inTwoDays.setHours(23, 59, 59, 999);
  const inFiveDays = new Date(today);
  inFiveDays.setDate(today.getDate() + 5);
  inFiveDays.setHours(23, 59, 59, 999);

  const projectActivities = store.activities.filter(
    (activity) => activity.tenantId === scope.tenantId && activity.projectId === scope.projectId
  );
  const active = projectActivities.filter((activity) => activity.status !== ActivityStatus.DONE);
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
    blocked: projectActivities
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

export async function listLocalPortfolios(tenantId = DEFAULT_TENANT_ID) {
  const store = await readStore();
  return store.portfolios.filter((portfolio) => portfolio.tenantId === tenantId && portfolio.active);
}

export async function listLocalProjects(input: { tenantId?: string | null; portfolioId?: string | null }) {
  const store = await readStore();
  const tenantId = input.tenantId ?? DEFAULT_TENANT_ID;
  return store.projects.filter(
    (project) =>
      project.tenantId === tenantId &&
      project.active &&
      (!input.portfolioId || project.portfolioId === input.portfolioId)
  );
}

export async function getLocalProject(input: { tenantId?: string | null; projectId: string }) {
  const store = await readStore();
  const tenantId = input.tenantId ?? DEFAULT_TENANT_ID;
  const project = store.projects.find((item) => item.id === input.projectId && item.tenantId === tenantId);

  if (!project) {
    throw new HttpError(404, "Projeto nao encontrado para o tenant informado.");
  }

  return project;
}

export async function createLocalProject(input: {
  tenantId?: string | null;
  portfolioId: string;
  name: string;
  description?: string | null;
  status?: string | null;
  health?: string | null;
  startDate?: string | null;
  targetDate?: string | null;
  ownerId?: string | null;
  active?: boolean;
}) {
  const store = await readStore();
  const tenantId = input.tenantId ?? DEFAULT_TENANT_ID;
  const portfolio = store.portfolios.find(
    (item) => item.id === input.portfolioId && item.tenantId === tenantId && item.active
  );

  if (!portfolio) {
    throw new HttpError(404, "Portfolio nao encontrado para o tenant informado.");
  }

  const timestamp = now();
  const project: LocalProject = {
    id: randomUUID(),
    tenantId,
    portfolioId: portfolio.id,
    name: input.name,
    description: input.description ?? null,
    status: input.status ?? "ACTIVE",
    health: input.health ?? null,
    startDate: input.startDate ? day(input.startDate) : null,
    targetDate: input.targetDate ? day(input.targetDate) : null,
    ownerId: input.ownerId ?? null,
    active: input.active ?? true,
    createdAt: timestamp,
    updatedAt: timestamp
  };

  store.projects.push(project);
  await writeStore(store);
  return project;
}

export async function updateLocalProject(
  projectId: string,
  input: {
    tenantId?: string | null;
    name?: string;
    description?: string | null;
    status?: string | null;
    health?: string | null;
    startDate?: string | null;
    targetDate?: string | null;
    ownerId?: string | null;
    active?: boolean;
  }
) {
  const store = await readStore();
  const tenantId = input.tenantId ?? DEFAULT_TENANT_ID;
  const project = store.projects.find((item) => item.id === projectId && item.tenantId === tenantId);

  if (!project) {
    throw new HttpError(404, "Projeto nao encontrado para o tenant informado.");
  }

  if (input.name !== undefined) project.name = input.name;
  if (input.description !== undefined) project.description = input.description;
  if (input.status !== undefined) project.status = input.status ?? "ACTIVE";
  if (input.health !== undefined) project.health = input.health;
  if (input.startDate !== undefined) project.startDate = input.startDate ? day(input.startDate) : null;
  if (input.targetDate !== undefined) project.targetDate = input.targetDate ? day(input.targetDate) : null;
  if (input.ownerId !== undefined) project.ownerId = input.ownerId;
  if (input.active !== undefined) project.active = input.active;
  project.updatedAt = now();

  await writeStore(store);
  return project;
}
