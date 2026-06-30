import { Router } from "express";
import { alertRoutes } from "./alert.routes.js";
import { activityRoutes, checklistRoutes } from "./activity.routes.js";
import { authRoutes } from "./auth.routes.js";
import { userRoutes } from "./user.routes.js";
import { authenticate } from "../middleware/auth.js";

export const routes = Router();

routes.get("/health", (_request, response) => {
  response.json({ status: "ok", app: "PMO Board API" });
});

routes.use("/auth", authRoutes);
routes.use(authenticate);
routes.use("/users", userRoutes);
routes.use("/activities", activityRoutes);
routes.use("/checklist", checklistRoutes);
routes.use("/alerts", alertRoutes);
