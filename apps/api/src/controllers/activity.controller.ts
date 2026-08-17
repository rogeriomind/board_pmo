import type { Request, Response } from "express";
import {
  activityCreateSchema,
  activityQuerySchema,
  activityUpdateSchema,
  checklistCreateSchema,
  checklistUpdateSchema,
  commentCreateSchema,
  moveActivitySchema
} from "../schemas/activity.schema.js";
import { activityRepository } from "../services/activity.repository.js";
import { HttpError } from "../utils/httpError.js";
import { DEFAULT_PROJECT_ID, DEFAULT_TENANT_ID } from "../domain/pmoContext.js";

function currentUserId(request: Request) {
  if (!request.user?.id) {
    throw new HttpError(401, "Sessao expirada. Faca login novamente.");
  }

  return request.user.id;
}

function routeParam(request: Request, name: string) {
  const value = request.params[name];

  if (!value || Array.isArray(value)) {
    throw new HttpError(400, "Parametro de rota invalido.");
  }

  return value;
}

function singleQueryValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function currentScope(request: Request) {
  return {
    tenantId:
      singleQueryValue(request.query.tenantId) ??
      singleQueryValue(request.headers["x-tenant-id"]) ??
      singleQueryValue(request.body?.tenantId) ??
      DEFAULT_TENANT_ID,
    projectId:
      singleQueryValue(request.query.projectId) ??
      singleQueryValue(request.headers["x-project-id"]) ??
      singleQueryValue(request.body?.projectId) ??
      DEFAULT_PROJECT_ID
  };
}

export async function index(request: Request, response: Response) {
  const filters = activityQuerySchema.parse(request.query);
  const grouped = await activityRepository.listActivities(filters);
  return response.json(grouped);
}

export async function show(request: Request, response: Response) {
  const activity = await activityRepository.getActivityById(routeParam(request, "id"), currentScope(request));
  return response.json(activity);
}

export async function store(request: Request, response: Response) {
  const data = activityCreateSchema.parse(request.body);
  const activity = await activityRepository.createActivity(currentUserId(request), data);
  return response.status(201).json(activity);
}

export async function update(request: Request, response: Response) {
  const data = activityUpdateSchema.parse(request.body);
  const activity = await activityRepository.updateActivity(routeParam(request, "id"), currentUserId(request), data, {
    scope: currentScope(request)
  });
  return response.json(activity);
}

export async function updateStatus(request: Request, response: Response) {
  const data = moveActivitySchema.parse(request.body);
  const activity = await activityRepository.moveActivity(routeParam(request, "id"), currentUserId(request), data.status, data.reason, {
    scope: currentScope(request)
  });
  return response.json(activity);
}

export async function destroy(request: Request, response: Response) {
  const activity = await activityRepository.cancelActivity(routeParam(request, "id"), currentUserId(request), undefined, currentScope(request));
  return response.json(activity);
}

export async function addChecklist(request: Request, response: Response) {
  const data = checklistCreateSchema.parse(request.body);
  const item = await activityRepository.addChecklistItem(routeParam(request, "id"), currentUserId(request), data.title, currentScope(request));
  return response.status(201).json(item);
}

export async function patchChecklist(request: Request, response: Response) {
  const data = checklistUpdateSchema.parse(request.body);
  const item = await activityRepository.updateChecklistItem(routeParam(request, "itemId"), currentUserId(request), data, currentScope(request));
  return response.json(item);
}

export async function removeChecklist(request: Request, response: Response) {
  await activityRepository.deleteChecklistItem(routeParam(request, "itemId"), currentUserId(request), currentScope(request));
  return response.status(204).send();
}

export async function addActivityComment(request: Request, response: Response) {
  const data = commentCreateSchema.parse(request.body);
  const comment = await activityRepository.addComment(routeParam(request, "id"), currentUserId(request), data.message, {
    scope: currentScope(request)
  });
  return response.status(201).json(comment);
}

export async function comments(request: Request, response: Response) {
  const items = await activityRepository.listComments(routeParam(request, "id"), currentScope(request));
  return response.json(items);
}

export async function history(request: Request, response: Response) {
  const items = await activityRepository.listHistory(routeParam(request, "id"), currentScope(request));
  return response.json(items);
}
