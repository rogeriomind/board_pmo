import type { Request, Response } from "express";
import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { listLocalUsers } from "../services/localStore.service.js";

export async function listUsers(_request: Request, response: Response) {
  if (env.DATA_DRIVER === "json") {
    return response.json(await listLocalUsers());
  }

  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      avatarUrl: true
    },
    orderBy: { name: "asc" }
  });

  return response.json(users);
}
