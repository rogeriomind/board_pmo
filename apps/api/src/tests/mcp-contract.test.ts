import assert from "node:assert/strict";
import test from "node:test";
import { ActivityStatus, Priority } from "@prisma/client";
import { DEFAULT_PROJECT_ID, DEFAULT_TENANT_ID } from "../domain/pmoContext.js";

process.env.DATABASE_URL ??= "postgresql://pmo:pmo@localhost:5432/pmo_board?schema=public";
process.env.JWT_SECRET ??= "development-secret-change-me";

const {
  addCommentInputSchema,
  createTaskInputSchema,
  getTaskInputSchema,
  listBlockersInputSchema,
  listMyTasksInputSchema,
  moveTaskInputSchema,
  projectStatusInputSchema,
  searchTasksInputSchema,
  updateTaskInputSchema
} = await import("../mcp/server.js");

test("MCP read contracts require tenantId and projectId for project-scoped tools", () => {
  assert.throws(() => projectStatusInputSchema.parse({ projectId: DEFAULT_PROJECT_ID }), /tenantId/);
  assert.throws(() => searchTasksInputSchema.parse({ tenantId: DEFAULT_TENANT_ID }), /projectId/);
  assert.throws(() => getTaskInputSchema.parse({ id: DEFAULT_PROJECT_ID, tenantId: DEFAULT_TENANT_ID }), /projectId/);
  assert.throws(() => listBlockersInputSchema.parse({ projectId: DEFAULT_PROJECT_ID }), /tenantId/);
  assert.throws(() => listMyTasksInputSchema.parse({ tenantId: DEFAULT_TENANT_ID }), /projectId/);

  assert.equal(
    projectStatusInputSchema.parse({
      tenantId: DEFAULT_TENANT_ID,
      projectId: DEFAULT_PROJECT_ID
    }).projectId,
    DEFAULT_PROJECT_ID
  );
});

test("MCP write contracts require tenantId, projectId and idempotencyKey", () => {
  const baseTask = {
    tenantId: DEFAULT_TENANT_ID,
    projectId: DEFAULT_PROJECT_ID,
    title: "Nova tarefa",
    status: ActivityStatus.TODO,
    priority: Priority.MEDIUM,
    idempotencyKey: "msg-1"
  };

  assert.throws(() => createTaskInputSchema.parse({ ...baseTask, idempotencyKey: undefined }), /idempotencyKey/);
  assert.equal(createTaskInputSchema.parse(baseTask).projectId, DEFAULT_PROJECT_ID);

  assert.throws(
    () =>
      updateTaskInputSchema.parse({
        id: DEFAULT_PROJECT_ID,
        tenantId: DEFAULT_TENANT_ID,
        projectId: DEFAULT_PROJECT_ID,
        title: "Atualizada"
      }),
    /idempotencyKey/
  );

  assert.throws(
    () =>
      moveTaskInputSchema.parse({
        id: DEFAULT_PROJECT_ID,
        tenantId: DEFAULT_TENANT_ID,
        projectId: DEFAULT_PROJECT_ID,
        status: ActivityStatus.BLOCKED,
        reason: "Bloqueio"
      }),
    /idempotencyKey/
  );

  assert.throws(
    () =>
      addCommentInputSchema.parse({
        id: DEFAULT_PROJECT_ID,
        tenantId: DEFAULT_TENANT_ID,
        projectId: DEFAULT_PROJECT_ID,
        message: "Comentario"
      }),
    /idempotencyKey/
  );
});
