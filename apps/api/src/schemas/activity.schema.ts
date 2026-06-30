import { ActivityStatus, Priority } from "@prisma/client";
import { z } from "zod";

const dateString = z
  .string()
  .min(10)
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use o formato YYYY-MM-DD.");

export const activityQuerySchema = z.object({
  status: z.nativeEnum(ActivityStatus).optional(),
  assigneeId: z.string().uuid().optional(),
  priority: z.nativeEnum(Priority).optional(),
  search: z.string().trim().optional(),
  dueDateFrom: dateString.optional(),
  dueDateTo: dateString.optional()
});

export const activityCreateSchema = z.object({
  title: z.string().trim().min(3, "Titulo deve ter pelo menos 3 caracteres."),
  description: z.string().trim().optional().nullable(),
  status: z.nativeEnum(ActivityStatus).default(ActivityStatus.BACKLOG),
  priority: z.nativeEnum(Priority).default(Priority.MEDIUM),
  assigneeId: z.string().uuid().optional().nullable(),
  dueDate: dateString.optional().nullable(),
  tags: z.array(z.string().trim().min(1)).default([]),
  checklist: z.array(z.string().trim().min(1)).default([])
});

export const activityUpdateSchema = activityCreateSchema
  .omit({ status: true })
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "Informe ao menos um campo para atualizar."
  });

export const moveActivitySchema = z.object({
  status: z.nativeEnum(ActivityStatus),
  reason: z.string().trim().optional()
});

export const checklistCreateSchema = z.object({
  title: z.string().trim().min(2, "Informe o item do checklist.")
});

export const checklistUpdateSchema = z
  .object({
    title: z.string().trim().min(2).optional(),
    isDone: z.boolean().optional()
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Informe ao menos um campo para atualizar."
  });

export const commentCreateSchema = z.object({
  message: z.string().trim().min(2, "Escreva um comentario.")
});
