import type { Request, Response } from "express";
import { DEFAULT_PROJECT_ID, DEFAULT_TENANT_ID } from "../domain/pmoContext.js";
import { activityRepository } from "../services/activity.repository.js";

function singleValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export async function index(request: Request, response: Response) {
  const alerts = await activityRepository.listAlerts({
    tenantId:
      singleValue(request.query.tenantId) ??
      singleValue(request.headers["x-tenant-id"]) ??
      DEFAULT_TENANT_ID,
    projectId:
      singleValue(request.query.projectId) ??
      singleValue(request.headers["x-project-id"]) ??
      DEFAULT_PROJECT_ID
  });
  return response.json(alerts);
}
