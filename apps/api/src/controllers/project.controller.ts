import type { Request, Response } from "express";
import { DEFAULT_TENANT_ID } from "../domain/pmoContext.js";
import {
  portfolioProjectQuerySchema,
  projectActivityQuerySchema,
  projectCreateSchema,
  projectStatusQuerySchema,
  projectUpdateSchema
} from "../schemas/project.schema.js";
import {
  createProject,
  getProject,
  getProjectStatus,
  listPortfolios,
  listProjectActivities,
  listProjects,
  updateProject
} from "../services/project.service.js";
import { HttpError } from "../utils/httpError.js";

function routeParam(request: Request, name: string) {
  const value = request.params[name];

  if (!value || Array.isArray(value)) {
    throw new HttpError(400, "Parametro de rota invalido.");
  }

  return value;
}

function singleValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function tenantId(request: Request, parsedTenantId?: string | null) {
  return parsedTenantId ?? singleValue(request.headers["x-tenant-id"]) ?? DEFAULT_TENANT_ID;
}

export async function portfoliosIndex(request: Request, response: Response) {
  const query = portfolioProjectQuerySchema.parse(request.query);
  const portfolios = await listPortfolios(tenantId(request, query.tenantId));
  return response.json(portfolios);
}

export async function portfolioProjects(request: Request, response: Response) {
  const query = portfolioProjectQuerySchema.parse(request.query);
  const projects = await listProjects({
    tenantId: tenantId(request, query.tenantId),
    portfolioId: routeParam(request, "id")
  });

  return response.json(projects);
}

export async function showProject(request: Request, response: Response) {
  const query = portfolioProjectQuerySchema.parse(request.query);
  const project = await getProject({
    tenantId: tenantId(request, query.tenantId),
    projectId: routeParam(request, "id")
  });

  return response.json(project);
}

export async function projectActivities(request: Request, response: Response) {
  const query = projectActivityQuerySchema.parse(request.query);
  const { tenantId: parsedTenantId, ...filters } = query;
  const activities = await listProjectActivities({
    tenantId: tenantId(request, parsedTenantId),
    projectId: routeParam(request, "id"),
    filters
  });

  return response.json(activities);
}

export async function projectStatus(request: Request, response: Response) {
  const query = projectStatusQuerySchema.parse(request.query);
  const status = await getProjectStatus({
    tenantId: tenantId(request, query.tenantId),
    projectId: routeParam(request, "id"),
    dueSoonDays: query.dueSoonDays
  });

  return response.json(status);
}

export async function storeProject(request: Request, response: Response) {
  const data = projectCreateSchema.parse(request.body);
  const project = await createProject({
    ...data,
    tenantId: tenantId(request, data.tenantId)
  });

  return response.status(201).json(project);
}

export async function patchProject(request: Request, response: Response) {
  const data = projectUpdateSchema.parse(request.body);
  const project = await updateProject(routeParam(request, "id"), {
    ...data,
    tenantId: tenantId(request, data.tenantId)
  });

  return response.json(project);
}
