import jwt from "jsonwebtoken";
import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env.js";
import { HttpError } from "../utils/httpError.js";

type JwtPayload = {
  sub: string;
  name: string;
  email: string;
};

export function authenticate(request: Request, _response: Response, next: NextFunction) {
  const header = request.headers.authorization;
  const [, token] = header?.split(" ") ?? [];

  if (!token) {
    throw new HttpError(401, "Sessao expirada. Faca login novamente.");
  }

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    request.user = {
      id: payload.sub,
      name: payload.name,
      email: payload.email
    };
    next();
  } catch {
    throw new HttpError(401, "Token invalido ou expirado.");
  }
}
