import { env } from "../config/env.js";
import { DEFAULT_TENANT_ID } from "../domain/pmoContext.js";
import { prisma } from "../lib/prisma.js";
import { HttpError } from "../utils/httpError.js";
import { buildProjectStatusReport } from "./activityStatus.service.js";
import { activityRepository } from "./activity.repository.js";
import {
  createLocalProject,
  getLocalProject,
  listLocalPortfolios,
  listLocalProjects,
  updateLocalProject
} from "./localStore.service.js";

type ProjectMutation = {
  tenantId?: string | null;
  portfolioId?: string;
  name?: string;
  description?: string | null;
  status?: string | null;
  health?: string | null;
  startDate?: string | null;
  targetDate?: string | null;
  ownerId?: string | null;
  active?: boolean;
};

function tenant(tenantId?: string | null) {
  return tenantId ?? DEFAULT_TENANT_ID;
}

function date(value?: string | null) {
  return value ? new Date(`${value}T12:00:00.000Z`) : null;
}

async function ensurePortfolio(tenantId: string, portfolioId: string) {
  const portfolio = await prisma.portfolio.findFirst({
    where: { id: portfolioId, tenantId, active: true }
  });

  if (!portfolio) {
    throw new HttpError(404, "Portfolio nao encontrado para o tenant informado.");
  }

  return portfolio;
}

export async function listPortfolios(tenantId?: string | null) {
  const currentTenant = tenant(tenantId);

  if (env.DATA_DRIVER === "json") {
    return listLocalPortfolios(currentTenant);
  }

  return prisma.portfolio.findMany({
    where: { tenantId: currentTenant, active: true },
    orderBy: { createdAt: "asc" }
  });
}

export async function listProjects(input: { tenantId?: string | null; portfolioId?: string | null }) {
  const currentTenant = tenant(input.tenantId);

  if (env.DATA_DRIVER === "json") {
    return listLocalProjects({ tenantId: currentTenant, portfolioId: input.portfolioId });
  }

  return prisma.project.findMany({
    where: {
      tenantId: currentTenant,
      active: true,
      portfolioId: input.portfolioId ?? undefined
    },
    include: {
      owner: { select: { id: true, name: true, email: true, avatarUrl: true } },
      portfolio: true
    },
    orderBy: { updatedAt: "desc" }
  });
}

export async function getProject(input: { tenantId?: string | null; projectId: string }) {
  const currentTenant = tenant(input.tenantId);

  if (env.DATA_DRIVER === "json") {
    return getLocalProject({ tenantId: currentTenant, projectId: input.projectId });
  }

  const project = await prisma.project.findFirst({
    where: { id: input.projectId, tenantId: currentTenant },
    include: {
      owner: { select: { id: true, name: true, email: true, avatarUrl: true } },
      portfolio: true
    }
  });

  if (!project) {
    throw new HttpError(404, "Projeto nao encontrado para o tenant informado.");
  }

  return project;
}

export async function createProject(input: ProjectMutation & { portfolioId: string; name: string }) {
  const currentTenant = tenant(input.tenantId);

  if (env.DATA_DRIVER === "json") {
    return createLocalProject({ ...input, tenantId: currentTenant });
  }

  await ensurePortfolio(currentTenant, input.portfolioId);

  return prisma.project.create({
    data: {
      tenantId: currentTenant,
      portfolioId: input.portfolioId,
      name: input.name,
      description: input.description ?? null,
      status: input.status ?? "ACTIVE",
      health: input.health ?? null,
      startDate: date(input.startDate),
      targetDate: date(input.targetDate),
      ownerId: input.ownerId ?? null,
      active: input.active ?? true
    }
  });
}

export async function updateProject(projectId: string, input: ProjectMutation) {
  const currentTenant = tenant(input.tenantId);

  if (env.DATA_DRIVER === "json") {
    return updateLocalProject(projectId, { ...input, tenantId: currentTenant });
  }

  await getProject({ tenantId: currentTenant, projectId });

  return prisma.project.update({
    where: { id: projectId },
    data: {
      name: input.name,
      description: input.description,
      status: input.status ?? undefined,
      health: input.health,
      startDate: input.startDate === undefined ? undefined : date(input.startDate),
      targetDate: input.targetDate === undefined ? undefined : date(input.targetDate),
      ownerId: input.ownerId,
      active: input.active
    }
  });
}

export async function listProjectActivities(input: {
  tenantId?: string | null;
  projectId: string;
  filters?: Record<string, unknown>;
}) {
  const currentTenant = tenant(input.tenantId);
  await getProject({ tenantId: currentTenant, projectId: input.projectId });

  return activityRepository.listActivities({
    ...(input.filters ?? {}),
    tenantId: currentTenant,
    projectId: input.projectId
  });
}

export async function getProjectStatus(input: { tenantId?: string | null; projectId: string; dueSoonDays?: number }) {
  const currentTenant = tenant(input.tenantId);
  const grouped = await listProjectActivities({
    tenantId: currentTenant,
    projectId: input.projectId
  });

  return buildProjectStatusReport({
    tenantId: currentTenant,
    projectId: input.projectId,
    grouped,
    dueSoonDays: input.dueSoonDays
  });
}
