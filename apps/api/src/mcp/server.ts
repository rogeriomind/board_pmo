import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { ActivityStatus, Priority } from "@prisma/client";
import { fileURLToPath } from "node:url";
import { z, ZodError } from "zod";
import {
  activityCreateSchema,
  activityQuerySchema,
  commentCreateSchema,
  moveActivitySchema
} from "../schemas/activity.schema.js";
import { activityRepository } from "../services/activity.repository.js";
import { findBoardUser, resolveBoardActor } from "../services/boardUser.service.js";
import { HttpError } from "../utils/httpError.js";

type BoardTask = {
  id: string;
  title: string;
  status: ActivityStatus;
  priority: Priority;
  assigneeId?: string | null;
  assignee?: unknown;
  dueDate?: Date | string | null;
  completedAt?: Date | string | null;
  blockedReason?: string | null;
  canceledReason?: string | null;
  tags?: unknown;
  [key: string]: unknown;
};

type GroupedTasks = Partial<Record<ActivityStatus, BoardTask[]>>;

const actorFields = {
  actorUserId: z.string().uuid().optional().nullable().describe("ID do usuario que executa a acao."),
  actorEmail: z.string().email().optional().nullable().describe("E-mail do usuario que executa a acao.")
};

const optionalDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use o formato YYYY-MM-DD.")
  .optional()
  .nullable();

const searchTasksInputSchema = activityQuerySchema.extend({
  limit: z.number().int().min(1).max(200).default(50)
});

const getTaskInputSchema = z.object({
  id: z.string().uuid()
});

const createTaskInputSchema = activityCreateSchema.extend(actorFields);

const updateTaskInputSchema = z
  .object({
    id: z.string().uuid(),
    title: z.string().trim().min(3).optional(),
    description: z.string().trim().optional().nullable(),
    priority: z.nativeEnum(Priority).optional(),
    assigneeId: z.string().uuid().optional().nullable(),
    dueDate: optionalDate,
    tags: z.array(z.string().trim().min(1)).optional(),
    checklist: z.array(z.string().trim().min(1)).optional(),
    ...actorFields
  })
  .refine(
    (value) =>
      ["title", "description", "priority", "assigneeId", "dueDate", "tags", "checklist"].some(
        (field) => value[field as keyof typeof value] !== undefined
      ),
    { message: "Informe ao menos um campo para atualizar." }
  );

const moveTaskInputSchema = z
  .object({
    id: z.string().uuid(),
    ...actorFields
  })
  .merge(moveActivitySchema);

const addCommentInputSchema = z.object({
  id: z.string().uuid(),
  message: commentCreateSchema.shape.message,
  ...actorFields
});

const projectStatusInputSchema = z.object({
  dueSoonDays: z.number().int().min(1).max(90).default(7)
});

const listBlockersInputSchema = z.object({
  assigneeId: z.string().uuid().optional().nullable(),
  assigneeEmail: z.string().email().optional().nullable()
});

const listMyTasksInputSchema = z.object({
  assigneeId: z.string().uuid().optional().nullable(),
  assigneeEmail: z.string().email().optional().nullable(),
  includeCompleted: z.boolean().default(false),
  ...actorFields
});

function toRecord(data: unknown): Record<string, unknown> {
  if (data && typeof data === "object" && !Array.isArray(data)) {
    return data as Record<string, unknown>;
  }

  return { result: data };
}

function toolResult(data: unknown): CallToolResult {
  const structuredContent = toRecord(data);

  return {
    structuredContent,
    content: [
      {
        type: "text",
        text: JSON.stringify(structuredContent, null, 2)
      }
    ]
  };
}

function toolError(error: unknown): CallToolResult {
  const payload =
    error instanceof ZodError
      ? { error: "Entrada invalida.", details: error.flatten() }
      : error instanceof HttpError
        ? { error: error.message, statusCode: error.statusCode, details: error.details }
        : error instanceof Error
          ? { error: error.message }
          : { error: "Erro desconhecido.", details: error };

  return {
    isError: true,
    structuredContent: payload,
    content: [
      {
        type: "text",
        text: JSON.stringify(payload, null, 2)
      }
    ]
  };
}

async function runTool(handler: () => Promise<unknown>): Promise<CallToolResult> {
  try {
    return toolResult(await handler());
  } catch (error) {
    return toolError(error);
  }
}

function flattenGroupedTasks(grouped: unknown) {
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

async function resolveAssignee(input: { assigneeId?: string | null; assigneeEmail?: string | null }) {
  if (!input.assigneeId && !input.assigneeEmail) {
    return null;
  }

  const user = await findBoardUser({ userId: input.assigneeId, email: input.assigneeEmail });

  if (!user) {
    throw new HttpError(404, "Responsavel informado nao encontrado.");
  }

  return user;
}

function registerTools(server: McpServer) {
  server.registerTool(
    "board_search_tasks",
    {
      title: "Buscar tarefas do board",
      description: "Busca tarefas por status, responsavel, prioridade, texto e janela de vencimento.",
      inputSchema: searchTasksInputSchema,
      annotations: { readOnlyHint: true, openWorldHint: false }
    },
    async (input) =>
      runTool(async () => {
        const { limit, ...filters } = searchTasksInputSchema.parse(input);
        const grouped = await activityRepository.listActivities(filters);
        const tasks = flattenGroupedTasks(grouped);

        return {
          count: tasks.length,
          returned: Math.min(tasks.length, limit),
          limit,
          tasks: tasks.slice(0, limit)
        };
      })
  );

  server.registerTool(
    "board_get_task",
    {
      title: "Obter tarefa",
      description: "Retorna uma tarefa com comentarios, historico, checklist, anexos, tags e usuarios relacionados.",
      inputSchema: getTaskInputSchema,
      annotations: { readOnlyHint: true, openWorldHint: false }
    },
    async (input) =>
      runTool(async () => {
        const { id } = getTaskInputSchema.parse(input);
        const task = await activityRepository.getActivityById(id);
        return { task };
      })
  );

  server.registerTool(
    "board_create_task",
    {
      title: "Criar tarefa",
      description: "Cria uma tarefa no board e registra historico em nome do usuario ator.",
      inputSchema: createTaskInputSchema,
      annotations: { destructiveHint: false, idempotentHint: false, openWorldHint: false }
    },
    async (input) =>
      runTool(async () => {
        const parsed = createTaskInputSchema.parse(input);
        const { actorUserId, actorEmail, ...data } = parsed;
        const actor = await resolveBoardActor({ actorUserId, actorEmail });
        const task = await activityRepository.createActivity(actor.id, data);

        return { actor, task };
      })
  );

  server.registerTool(
    "board_update_task",
    {
      title: "Atualizar tarefa",
      description: "Atualiza campos editaveis de uma tarefa e registra historico.",
      inputSchema: updateTaskInputSchema,
      annotations: { destructiveHint: false, idempotentHint: false, openWorldHint: false }
    },
    async (input) =>
      runTool(async () => {
        const parsed = updateTaskInputSchema.parse(input);
        const { id, actorUserId, actorEmail, ...data } = parsed;
        const actor = await resolveBoardActor({ actorUserId, actorEmail });
        const task = await activityRepository.updateActivity(id, actor.id, data);

        return { actor, task };
      })
  );

  server.registerTool(
    "board_move_task",
    {
      title: "Mover tarefa",
      description: "Move uma tarefa para outro status, respeitando as regras do board.",
      inputSchema: moveTaskInputSchema,
      annotations: { destructiveHint: false, idempotentHint: false, openWorldHint: false }
    },
    async (input) =>
      runTool(async () => {
        const parsed = moveTaskInputSchema.parse(input);
        const { id, status, reason, actorUserId, actorEmail } = parsed;
        const actor = await resolveBoardActor({ actorUserId, actorEmail });
        const task = await activityRepository.moveActivity(id, actor.id, status, reason);

        return { actor, task };
      })
  );

  server.registerTool(
    "board_add_comment",
    {
      title: "Adicionar comentario",
      description: "Adiciona um comentario a uma tarefa e registra historico.",
      inputSchema: addCommentInputSchema,
      annotations: { destructiveHint: false, idempotentHint: false, openWorldHint: false }
    },
    async (input) =>
      runTool(async () => {
        const parsed = addCommentInputSchema.parse(input);
        const { id, message, actorUserId, actorEmail } = parsed;
        const actor = await resolveBoardActor({ actorUserId, actorEmail });
        const comment = await activityRepository.addComment(id, actor.id, message);

        return { actor, comment };
      })
  );

  server.registerTool(
    "board_get_project_status",
    {
      title: "Status do projeto",
      description: "Resume o estado geral do board: totais por status/prioridade, atrasos, proximos vencimentos e bloqueios.",
      inputSchema: projectStatusInputSchema,
      annotations: { readOnlyHint: true, openWorldHint: false }
    },
    async (input) =>
      runTool(async () => {
        const { dueSoonDays } = projectStatusInputSchema.parse(input);
        const grouped = await activityRepository.listActivities({});
        const tasks = flattenGroupedTasks(grouped);
        const activeTasks = tasks.filter(activeTask);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const dueSoonLimit = new Date(today);
        dueSoonLimit.setDate(today.getDate() + dueSoonDays);
        dueSoonLimit.setHours(23, 59, 59, 999);

        const overdue = activeTasks.filter((task) => {
          const dueDate = parseTaskDate(task.dueDate);
          return dueDate ? dueDate < today : false;
        });
        const dueSoon = activeTasks.filter((task) => {
          const dueDate = parseTaskDate(task.dueDate);
          return dueDate ? dueDate >= today && dueDate <= dueSoonLimit : false;
        });
        const blockers = tasks.filter((task) => task.status === ActivityStatus.BLOCKED);
        const completedCount = tasks.filter((task) => task.status === ActivityStatus.DONE).length;

        return {
          generatedAt: new Date().toISOString(),
          totalTasks: tasks.length,
          activeTasks: activeTasks.length,
          completedTasks: completedCount,
          canceledTasks: tasks.filter((task) => task.status === ActivityStatus.CANCELED).length,
          completionRate: tasks.length === 0 ? 0 : Number(((completedCount / tasks.length) * 100).toFixed(2)),
          countsByStatus: statusCounts(tasks),
          countsByPriority: priorityCounts(tasks),
          overdue: {
            count: overdue.length,
            tasks: overdue.map(taskSummary)
          },
          dueSoon: {
            days: dueSoonDays,
            count: dueSoon.length,
            tasks: dueSoon.map(taskSummary)
          },
          blockers: {
            count: blockers.length,
            tasks: blockers.map(taskSummary)
          }
        };
      })
  );

  server.registerTool(
    "board_list_blockers",
    {
      title: "Listar bloqueios",
      description: "Lista tarefas bloqueadas, opcionalmente filtradas por responsavel.",
      inputSchema: listBlockersInputSchema,
      annotations: { readOnlyHint: true, openWorldHint: false }
    },
    async (input) =>
      runTool(async () => {
        const parsed = listBlockersInputSchema.parse(input);
        const assignee = await resolveAssignee(parsed);
        const grouped = await activityRepository.listActivities({
          status: ActivityStatus.BLOCKED,
          assigneeId: assignee?.id ?? undefined
        });
        const blockers = flattenGroupedTasks(grouped);

        return {
          assignee,
          count: blockers.length,
          blockers: blockers.map(taskSummary)
        };
      })
  );

  server.registerTool(
    "board_list_my_tasks",
    {
      title: "Listar minhas tarefas",
      description: "Lista tarefas de um responsavel. Sem responsavel explicito, usa o ator/default do MCP.",
      inputSchema: listMyTasksInputSchema,
      annotations: { readOnlyHint: true, openWorldHint: false }
    },
    async (input) =>
      runTool(async () => {
        const parsed = listMyTasksInputSchema.parse(input);
        const assignee =
          (await resolveAssignee({ assigneeId: parsed.assigneeId, assigneeEmail: parsed.assigneeEmail })) ??
          (await resolveBoardActor({ actorUserId: parsed.actorUserId, actorEmail: parsed.actorEmail }));
        const grouped = await activityRepository.listActivities({ assigneeId: assignee.id });
        const tasks = flattenGroupedTasks(grouped).filter((task) => parsed.includeCompleted || activeTask(task));

        return {
          assignee,
          includeCompleted: parsed.includeCompleted,
          count: tasks.length,
          tasks: tasks.map(taskSummary)
        };
      })
  );
}

export function createBoardMcpServer() {
  const server = new McpServer({
    name: "pmo-board-mcp",
    version: "1.0.0"
  });

  registerTools(server);
  return server;
}

async function main() {
  const server = createBoardMcpServer();
  await server.connect(new StdioServerTransport());
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
