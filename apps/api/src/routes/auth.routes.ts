import { Router } from "express";
import { login } from "../controllers/auth.controller.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const authRoutes = Router();

authRoutes.post("/login", asyncHandler(login));
