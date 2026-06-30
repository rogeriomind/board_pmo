import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { Request, Response } from "express";
import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { loginSchema } from "../schemas/auth.schema.js";
import { findLocalUserByEmail } from "../services/localStore.service.js";
import { HttpError } from "../utils/httpError.js";

export async function login(request: Request, response: Response) {
  const data = loginSchema.parse(request.body);
  const user =
    env.DATA_DRIVER === "json"
      ? await findLocalUserByEmail(data.email)
      : await prisma.user.findUnique({ where: { email: data.email } });

  if (!user) {
    throw new HttpError(401, "E-mail ou senha invalidos.");
  }

  const passwordMatches = await bcrypt.compare(data.password, user.passwordHash);

  if (!passwordMatches) {
    throw new HttpError(401, "E-mail ou senha invalidos.");
  }

  const token = jwt.sign(
    {
      name: user.name,
      email: user.email
    },
    env.JWT_SECRET,
    {
      subject: user.id,
      expiresIn: "8h"
    }
  );

  return response.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      avatarUrl: user.avatarUrl
    }
  });
}
