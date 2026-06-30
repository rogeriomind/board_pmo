import type { Request, Response } from "express";
import { activityRepository } from "../services/activity.repository.js";

export async function index(_request: Request, response: Response) {
  const alerts = await activityRepository.listAlerts();
  return response.json(alerts);
}
