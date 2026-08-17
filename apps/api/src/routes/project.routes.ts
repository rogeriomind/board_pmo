import { Router } from "express";
import {
  patchProject,
  portfolioProjects,
  portfoliosIndex,
  projectActivities,
  projectStatus,
  showProject,
  storeProject
} from "../controllers/project.controller.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const portfolioRoutes = Router();
export const projectRoutes = Router();

portfolioRoutes.get("/", asyncHandler(portfoliosIndex));
portfolioRoutes.get("/:id/projects", asyncHandler(portfolioProjects));

projectRoutes.post("/", asyncHandler(storeProject));
projectRoutes.get("/:id", asyncHandler(showProject));
projectRoutes.patch("/:id", asyncHandler(patchProject));
projectRoutes.get("/:id/activities", asyncHandler(projectActivities));
projectRoutes.get("/:id/status", asyncHandler(projectStatus));
