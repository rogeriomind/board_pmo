import { z } from "zod";

const dateString = z
  .string()
  .min(10)
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use o formato YYYY-MM-DD.");

export const portfolioProjectQuerySchema = z.object({
  tenantId: z.string().uuid().optional()
});

export const projectActivityQuerySchema = z.object({
  tenantId: z.string().uuid().optional(),
  status: z
    .enum(["BACKLOG", "TODO", "IN_PROGRESS", "BLOCKED", "IN_REVIEW", "DONE", "CANCELED"])
    .optional(),
  assigneeId: z.string().uuid().optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
  search: z.string().trim().optional(),
  dueDateFrom: dateString.optional(),
  dueDateTo: dateString.optional()
});

export const projectStatusQuerySchema = z.object({
  tenantId: z.string().uuid().optional(),
  dueSoonDays: z.coerce.number().int().min(1).max(90).default(7)
});

export const projectCreateSchema = z.object({
  tenantId: z.string().uuid().optional().nullable(),
  portfolioId: z.string().uuid(),
  name: z.string().trim().min(3),
  description: z.string().trim().optional().nullable(),
  status: z.string().trim().min(1).default("ACTIVE"),
  health: z.string().trim().optional().nullable(),
  startDate: dateString.optional().nullable(),
  targetDate: dateString.optional().nullable(),
  ownerId: z.string().uuid().optional().nullable(),
  active: z.boolean().optional()
});

export const projectUpdateSchema = projectCreateSchema
  .omit({ portfolioId: true })
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "Informe ao menos um campo para atualizar."
  });
