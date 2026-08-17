import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { ActivityStatus, Priority } from "@prisma/client";
import { DEFAULT_PORTFOLIO_ID, DEFAULT_PROJECT_ID, DEFAULT_TENANT_ID } from "../domain/pmoContext.js";

const tempDir = await mkdtemp(path.join(os.tmpdir(), "pmo-board-"));
process.env.LOCAL_STORE_FILE = path.join(tempDir, "local-store.json");

const {
  createLocalActivity,
  createLocalProject,
  listLocalActivities,
  listLocalPortfolios,
  listLocalProjects,
  listLocalUsers
} = await import("../services/localStore.service.js");

test.after(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

function flat(grouped: Awaited<ReturnType<typeof listLocalActivities>>) {
  return Object.values(grouped).flat();
}

async function firstUserId() {
  const users = await listLocalUsers();
  const userId = users[0]?.id;
  assert.ok(userId);
  return userId;
}

test("cria Tenant, Portfolio, Project default e Activity vinculada ao Project", async () => {
  const portfolios = await listLocalPortfolios(DEFAULT_TENANT_ID);
  const projects = await listLocalProjects({ tenantId: DEFAULT_TENANT_ID, portfolioId: DEFAULT_PORTFOLIO_ID });
  const userId = await firstUserId();

  assert.equal(portfolios[0]?.id, DEFAULT_PORTFOLIO_ID);
  assert.equal(projects[0]?.id, DEFAULT_PROJECT_ID);

  const activity = await createLocalActivity(userId, {
    tenantId: DEFAULT_TENANT_ID,
    projectId: DEFAULT_PROJECT_ID,
    title: "Atividade de dominio",
    status: ActivityStatus.TODO,
    priority: Priority.MEDIUM
  });

  assert.equal((activity as { tenantId: string }).tenantId, DEFAULT_TENANT_ID);
  assert.equal((activity as { projectId: string }).projectId, DEFAULT_PROJECT_ID);
});

test("isola atividades entre projetos", async () => {
  const userId = await firstUserId();
  const projectA = await createLocalProject({
    tenantId: DEFAULT_TENANT_ID,
    portfolioId: DEFAULT_PORTFOLIO_ID,
    name: "Project A"
  });
  const projectB = await createLocalProject({
    tenantId: DEFAULT_TENANT_ID,
    portfolioId: DEFAULT_PORTFOLIO_ID,
    name: "Project B"
  });

  const taskA = await createLocalActivity(userId, {
    tenantId: DEFAULT_TENANT_ID,
    projectId: projectA.id,
    title: "Task A",
    status: ActivityStatus.TODO,
    priority: Priority.MEDIUM
  });
  const taskB = await createLocalActivity(userId, {
    tenantId: DEFAULT_TENANT_ID,
    projectId: projectB.id,
    title: "Task B",
    status: ActivityStatus.TODO,
    priority: Priority.MEDIUM
  });

  const projectATasks = flat(await listLocalActivities({ tenantId: DEFAULT_TENANT_ID, projectId: projectA.id }));

  assert.ok(projectATasks.some((task) => task.id === (taskA as { id: string }).id));
  assert.ok(!projectATasks.some((task) => task.id === (taskB as { id: string }).id));
});

test("falha quando tenant e project nao pertencem um ao outro", async () => {
  const userId = await firstUserId();
  const otherTenantId = "11111111-1111-4111-8111-111111111111";

  await assert.rejects(
    createLocalActivity(userId, {
      tenantId: otherTenantId,
      projectId: DEFAULT_PROJECT_ID,
      title: "Tenant cruzado",
      status: ActivityStatus.TODO,
      priority: Priority.MEDIUM
    }),
    /Projeto nao encontrado/
  );
});

test("retry idempotente de create_task nao duplica atividade", async () => {
  const userId = await firstUserId();
  const options = {
    scope: { tenantId: DEFAULT_TENANT_ID, projectId: DEFAULT_PROJECT_ID },
    idempotency: {
      tenantId: DEFAULT_TENANT_ID,
      key: "abc123",
      operation: "board_create_task"
    }
  };

  const first = await createLocalActivity(
    userId,
    {
      tenantId: DEFAULT_TENANT_ID,
      projectId: DEFAULT_PROJECT_ID,
      title: "Criada uma vez",
      status: ActivityStatus.TODO,
      priority: Priority.MEDIUM
    },
    options
  );

  const second = await createLocalActivity(
    userId,
    {
      tenantId: DEFAULT_TENANT_ID,
      projectId: DEFAULT_PROJECT_ID,
      title: "Nao deve criar outra",
      status: ActivityStatus.TODO,
      priority: Priority.MEDIUM
    },
    options
  );

  const tasks = flat(await listLocalActivities({ tenantId: DEFAULT_TENANT_ID, projectId: DEFAULT_PROJECT_ID }));

  assert.equal((first as { id: string }).id, (second as { id: string }).id);
  assert.equal(tasks.filter((task) => task.id === (first as { id: string }).id).length, 1);
});
