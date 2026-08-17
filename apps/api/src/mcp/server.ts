import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { ActivityStatus, Priority } from "@prisma/client";
import type { Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { z, ZodError } from "zod";
import { env } from "../config/env.js";
import {
  activityCreateSchema,
  activityQuerySchema,
  commentCreateSchema,
  moveActivitySchema
} from "../schemas/activity.schema.js";
import {
  activeTask as isActiveTask,
  buildProjectStatusReport,
  flattenGroupedTasks as flattenActivityGroups,
  taskSummary as summarizeTask
} from "../services/activityStatus.service.js";
import { activityRepository } from "../services/activity.repository.js";
import { findBoardUser, resolveBoardActor, searchBoardUsers } from "../services/boardUser.service.js";
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

const projectScopeFields = {
  tenantId: z.string().uuid().describe("ID do tenant onde o projeto existe."),
  projectId: z.string().uuid().describe("ID do projeto que delimita a operacao.")
};

const idempotencyField = {
  idempotencyKey: z.string().trim().min(1).describe("Chave idempotente unica por tenant para retry seguro.")
};

const optionalDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use o formato YYYY-MM-DD.")
  .optional()
  .nullable();

export const searchTasksInputSchema = activityQuerySchema.extend({
  ...projectScopeFields,
  limit: z.number().int().min(1).max(200).default(50)
});

export const getTaskInputSchema = z.object({
  ...projectScopeFields,
  id: z.string().uuid()
});

const searchUsersInputSchema = z.object({
  query: z.string().trim().optional().nullable(),
  limit: z.number().int().min(1).max(100).default(20)
});

export const createTaskInputSchema = activityCreateSchema.extend({
  ...projectScopeFields,
  ...actorFields,
  ...idempotencyField
});

export const updateTaskInputSchema = z
  .object({
    id: z.string().uuid(),
    title: z.string().trim().min(3).optional(),
    description: z.string().trim().optional().nullable(),
    priority: z.nativeEnum(Priority).optional(),
    assigneeId: z.string().uuid().optional().nullable(),
    dueDate: optionalDate,
    tags: z.array(z.string().trim().min(1)).optional(),
    checklist: z.array(z.string().trim().min(1)).optional(),
    ...projectScopeFields,
    ...actorFields,
    ...idempotencyField
  })
  .refine(
    (value) =>
      ["title", "description", "priority", "assigneeId", "dueDate", "tags", "checklist"].some(
        (field) => value[field as keyof typeof value] !== undefined
      ),
    { message: "Informe ao menos um campo para atualizar." }
  );

export const moveTaskInputSchema = z
  .object({
    id: z.string().uuid(),
    ...projectScopeFields,
    ...actorFields,
    ...idempotencyField
  })
  .merge(moveActivitySchema);

export const addCommentInputSchema = z.object({
  ...projectScopeFields,
  id: z.string().uuid(),
  message: commentCreateSchema.shape.message,
  ...actorFields,
  ...idempotencyField
});

export const projectStatusInputSchema = z.object({
  ...projectScopeFields,
  dueSoonDays: z.number().int().min(1).max(90).default(7)
});

export const listBlockersInputSchema = z.object({
  ...projectScopeFields,
  assigneeId: z.string().uuid().optional().nullable(),
  assigneeEmail: z.string().email().optional().nullable()
});

export const listMyTasksInputSchema = z.object({
  ...projectScopeFields,
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
    "board_search_users",
    {
      title: "Buscar usuarios do board",
      description: "Busca usuarios do Board por nome ou e-mail para resolver responsaveis.",
      inputSchema: searchUsersInputSchema,
      annotations: { readOnlyHint: true, openWorldHint: false }
    },
    async (input) =>
      runTool(async () => {
        const parsed = searchUsersInputSchema.parse(input);
        const users = await searchBoardUsers(parsed);

        return {
          count: users.length,
          users
        };
      })
  );

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
        const tasks = flattenActivityGroups(grouped);

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
        const { id, tenantId, projectId } = getTaskInputSchema.parse(input);
        const task = await activityRepository.getActivityById(id, { tenantId, projectId });
        return { task };
      })
  );

  server.registerTool(
    "board_create_task",
    {
      title: "Criar tarefa",
      description: "Cria uma tarefa no board e registra historico em nome do usuario ator.",
      inputSchema: createTaskInputSchema,
      annotations: { destructiveHint: false, idempotentHint: true, openWorldHint: false }
    },
    async (input) =>
      runTool(async () => {
        const parsed = createTaskInputSchema.parse(input);
        const { actorUserId, actorEmail, tenantId, projectId, idempotencyKey, ...data } = parsed;
        const actor = await resolveBoardActor({ actorUserId, actorEmail });
        const task = await activityRepository.createActivity(actor.id, { ...data, tenantId, projectId }, {
          scope: { tenantId, projectId },
          idempotency: { tenantId, key: idempotencyKey, operation: "board_create_task" }
        });

        return { actor, task };
      })
  );

  server.registerTool(
    "board_update_task",
    {
      title: "Atualizar tarefa",
      description: "Atualiza campos editaveis de uma tarefa e registra historico.",
      inputSchema: updateTaskInputSchema,
      annotations: { destructiveHint: false, idempotentHint: true, openWorldHint: false }
    },
    async (input) =>
      runTool(async () => {
        const parsed = updateTaskInputSchema.parse(input);
        const { id, actorUserId, actorEmail, tenantId, projectId, idempotencyKey, ...data } = parsed;
        const actor = await resolveBoardActor({ actorUserId, actorEmail });
        const task = await activityRepository.updateActivity(id, actor.id, data, {
          scope: { tenantId, projectId },
          idempotency: { tenantId, key: idempotencyKey, operation: "board_update_task" }
        });

        return { actor, task };
      })
  );

  server.registerTool(
    "board_move_task",
    {
      title: "Mover tarefa",
      description: "Move uma tarefa para outro status, respeitando as regras do board.",
      inputSchema: moveTaskInputSchema,
      annotations: { destructiveHint: false, idempotentHint: true, openWorldHint: false }
    },
    async (input) =>
      runTool(async () => {
        const parsed = moveTaskInputSchema.parse(input);
        const { id, status, reason, actorUserId, actorEmail, tenantId, projectId, idempotencyKey } = parsed;
        const actor = await resolveBoardActor({ actorUserId, actorEmail });
        const task = await activityRepository.moveActivity(id, actor.id, status, reason, {
          scope: { tenantId, projectId },
          idempotency: { tenantId, key: idempotencyKey, operation: "board_move_task" }
        });

        return { actor, task };
      })
  );

  server.registerTool(
    "board_add_comment",
    {
      title: "Adicionar comentario",
      description: "Adiciona um comentario a uma tarefa e registra historico.",
      inputSchema: addCommentInputSchema,
      annotations: { destructiveHint: false, idempotentHint: true, openWorldHint: false }
    },
    async (input) =>
      runTool(async () => {
        const parsed = addCommentInputSchema.parse(input);
        const { id, message, actorUserId, actorEmail, tenantId, projectId, idempotencyKey } = parsed;
        const actor = await resolveBoardActor({ actorUserId, actorEmail });
        const comment = await activityRepository.addComment(id, actor.id, message, {
          scope: { tenantId, projectId },
          idempotency: { tenantId, key: idempotencyKey, operation: "board_add_comment" }
        });

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
        const { tenantId, projectId, dueSoonDays } = projectStatusInputSchema.parse(input);
        const grouped = await activityRepository.listActivities({ tenantId, projectId });

        return buildProjectStatusReport({
          tenantId,
          projectId,
          grouped,
          dueSoonDays
        });
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
          tenantId: parsed.tenantId,
          projectId: parsed.projectId,
          status: ActivityStatus.BLOCKED,
          assigneeId: assignee?.id ?? undefined
        });
        const blockers = flattenActivityGroups(grouped);

        return {
          assignee,
          count: blockers.length,
          blockers: blockers.map(summarizeTask)
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
        const grouped = await activityRepository.listActivities({
          tenantId: parsed.tenantId,
          projectId: parsed.projectId,
          assigneeId: assignee.id
        });
        const tasks = flattenActivityGroups(grouped).filter((task) => parsed.includeCompleted || isActiveTask(task));

        return {
          assignee,
          includeCompleted: parsed.includeCompleted,
          count: tasks.length,
          tasks: tasks.map(summarizeTask)
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

type CliOptions = {
  transport: "stdio" | "streamable-http";
  host: string;
  port: number;
  path: string;
};

async function main() {
  const options = parseCliOptions(process.argv.slice(2));
  if (options.transport === "streamable-http") {
    await runStreamableHttp(options);
    return;
  }

  await runStdio();
}

async function runStdio() {
  const server = createBoardMcpServer();
  await server.connect(new StdioServerTransport());
}

async function runStreamableHttp(options: CliOptions) {
  const app = createMcpExpressApp({ host: options.host });
  const transports: Record<string, StreamableHTTPServerTransport> = {};

  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      service: "pmo-board-mcp",
      transport: "streamable-http",
      sessions: Object.keys(transports).length
    });
  });

  app.post(options.path, async (req, res) => {
    await handleStreamableRequest(req, res, transports);
  });

  app.get(options.path, async (req, res) => {
    const transport = findTransport(req, res, transports);
    if (transport) {
      await transport.handleRequest(req, res);
    }
  });

  app.delete(options.path, async (req, res) => {
    const transport = findTransport(req, res, transports);
    if (transport) {
      await transport.handleRequest(req, res);
    }
  });

  app.listen(options.port, options.host, () => {
    console.log(`PMO Board MCP listening on http://${options.host}:${options.port}${options.path}`);
  });
}

async function handleStreamableRequest(
  req: Request,
  res: Response,
  transports: Record<string, StreamableHTTPServerTransport>
) {
  const sessionId = headerValue(req.headers["mcp-session-id"]);
  try {
    let transport = sessionId ? transports[sessionId] : undefined;
    if (!transport && !sessionId && isInitializeRequest(req.body)) {
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (newSessionId) => {
          if (transport) {
            transports[newSessionId] = transport;
          }
        },
        onsessionclosed: (closedSessionId) => {
          delete transports[closedSessionId];
        }
      });
      transport.onclose = () => {
        const closedSessionId = transport?.sessionId;
        if (closedSessionId) {
          delete transports[closedSessionId];
        }
      };

      const server = createBoardMcpServer();
      await server.connect(transport);
    }

    if (!transport) {
      res.status(400).json({
        jsonrpc: "2.0",
        error: {
          code: -32000,
          message: "Bad Request: No valid MCP session ID provided."
        },
        id: null
      });
      return;
    }

    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error("Error handling MCP request:", error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: null
      });
    }
  }
}

function findTransport(
  req: Request,
  res: Response,
  transports: Record<string, StreamableHTTPServerTransport>
) {
  const sessionId = headerValue(req.headers["mcp-session-id"]);
  const transport = sessionId ? transports[sessionId] : undefined;
  if (!transport) {
    res.status(400).send("Invalid or missing MCP session ID");
    return null;
  }
  return transport;
}

function parseCliOptions(args: string[]): CliOptions {
  const transport = readArg(args, "--transport", "stdio");
  if (transport !== "stdio" && transport !== "streamable-http") {
    throw new Error(`Unsupported MCP transport: ${transport}`);
  }

  return {
    transport,
    host: readArg(args, "--host", process.env.MCP_HOST ?? env.MCP_HOST),
    port: Number(readArg(args, "--port", process.env.MCP_PORT ?? String(env.MCP_PORT))),
    path: normalizePath(readArg(args, "--path", process.env.MCP_PATH ?? env.MCP_PATH))
  };
}

function readArg(args: string[], name: string, fallback: string) {
  const index = args.indexOf(name);
  if (index >= 0 && args[index + 1]) {
    return args[index + 1];
  }
  const withEquals = args.find((arg) => arg.startsWith(`${name}=`));
  return withEquals ? withEquals.slice(name.length + 1) : fallback;
}

function normalizePath(path: string) {
  const trimmed = path.trim() || "/mcp";
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

function headerValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
