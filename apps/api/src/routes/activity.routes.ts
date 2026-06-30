import { Router } from "express";
import {
  addActivityComment,
  addChecklist,
  comments,
  destroy,
  history,
  index,
  patchChecklist,
  removeChecklist,
  show,
  store,
  update,
  updateStatus
} from "../controllers/activity.controller.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const activityRoutes = Router();

activityRoutes.get("/", asyncHandler(index));
activityRoutes.post("/", asyncHandler(store));
activityRoutes.get("/:id", asyncHandler(show));
activityRoutes.patch("/:id", asyncHandler(update));
activityRoutes.patch("/:id/status", asyncHandler(updateStatus));
activityRoutes.delete("/:id", asyncHandler(destroy));
activityRoutes.post("/:id/checklist", asyncHandler(addChecklist));
activityRoutes.post("/:id/comments", asyncHandler(addActivityComment));
activityRoutes.get("/:id/comments", asyncHandler(comments));
activityRoutes.get("/:id/history", asyncHandler(history));

export const checklistRoutes = Router();

checklistRoutes.patch("/:itemId", asyncHandler(patchChecklist));
checklistRoutes.delete("/:itemId", asyncHandler(removeChecklist));
