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

export async function index(request: Request, response: Response) {
  const filters = activityQuerySchema.parse(request.query);
  const grouped = await activityRepository.listActivities(filters);
  return response.json(grouped);
}

export async function show(request: Request, response: Response) {
  const activity = await activityRepository.getActivityById(routeParam(request, "id"));
  return response.json(activity);
}

export async function store(request: Request, response: Response) {
  const data = activityCreateSchema.parse(request.body);
  const activity = await activityRepository.createActivity(currentUserId(request), data);
  return response.status(201).json(activity);
}

export async function update(request: Request, response: Response) {
  const data = activityUpdateSchema.parse(request.body);
  const activity = await activityRepository.updateActivity(routeParam(request, "id"), currentUserId(request), data);
  return response.json(activity);
}

export async function updateStatus(request: Request, response: Response) {
  const data = moveActivitySchema.parse(request.body);
  const activity = await activityRepository.moveActivity(routeParam(request, "id"), currentUserId(request), data.status, data.reason);
  return response.json(activity);
}

export async function destroy(request: Request, response: Response) {
  const activity = await activityRepository.cancelActivity(routeParam(request, "id"), currentUserId(request));
  return response.json(activity);
}

export async function addChecklist(request: Request, response: Response) {
  const data = checklistCreateSchema.parse(request.body);
  const item = await activityRepository.addChecklistItem(routeParam(request, "id"), currentUserId(request), data.title);
  return response.status(201).json(item);
}

export async function patchChecklist(request: Request, response: Response) {
  const data = checklistUpdateSchema.parse(request.body);
  const item = await activityRepository.updateChecklistItem(routeParam(request, "itemId"), currentUserId(request), data);
  return response.json(item);
}

export async function removeChecklist(request: Request, response: Response) {
  await activityRepository.deleteChecklistItem(routeParam(request, "itemId"), currentUserId(request));
  return response.status(204).send();
}

export async function addActivityComment(request: Request, response: Response) {
  const data = commentCreateSchema.parse(request.body);
  const comment = await activityRepository.addComment(routeParam(request, "id"), currentUserId(request), data.message);
  return response.status(201).json(comment);
}

export async function comments(request: Request, response: Response) {
  const items = await activityRepository.listComments(routeParam(request, "id"));
  return response.json(items);
}

export async function history(request: Request, response: Response) {
  const items = await activityRepository.listHistory(routeParam(request, "id"));
  return response.json(items);
}
