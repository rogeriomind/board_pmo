import { Router } from "express";
import { index } from "../controllers/alert.controller.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const alertRoutes = Router();

alertRoutes.get("/", asyncHandler(index));
