import { Prisma } from "@prisma/client";
import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { HttpError } from "../utils/httpError.js";

export function errorHandler(
  error: unknown,
  _request: Request,
  response: Response,
  _next: NextFunction
) {
  if (error instanceof ZodError) {
    return response.status(400).json({
      message: "Confira os campos informados.",
      issues: error.flatten()
    });
  }

  if (error instanceof HttpError) {
    return response.status(error.statusCode).json({
      message: error.message,
      details: error.details
    });
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return response.status(400).json({
      message: "Nao foi possivel concluir a operacao no banco de dados.",
      code: error.code
    });
  }

  console.error(error);
  return response.status(500).json({
    message: "Erro inesperado. Tente novamente em alguns instantes."
  });
}
