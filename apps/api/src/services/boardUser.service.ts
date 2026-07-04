import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { HttpError } from "../utils/httpError.js";
import { findLocalUserByEmail, listLocalUsers } from "./localStore.service.js";

export type BoardUser = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
};

const userSelect = {
  id: true,
  name: true,
  email: true,
  avatarUrl: true
};

function clean(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

function localUsers(users: Awaited<ReturnType<typeof listLocalUsers>>) {
  return users.filter((user): user is BoardUser => Boolean(user));
}

function publicLocalUser(user: Awaited<ReturnType<typeof findLocalUserByEmail>>) {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    avatarUrl: user.avatarUrl
  };
}

export async function findBoardUser(input: { userId?: string | null; email?: string | null }) {
  const userId = clean(input.userId);
  const email = clean(input.email);

  if (env.DATA_DRIVER === "json") {
    if (userId) {
      return localUsers(await listLocalUsers()).find((user) => user.id === userId) ?? null;
    }

    if (email) {
      return publicLocalUser(await findLocalUserByEmail(email));
    }

    return null;
  }

  if (userId) {
    return prisma.user.findUnique({ where: { id: userId }, select: userSelect });
  }

  if (email) {
    return prisma.user.findUnique({ where: { email }, select: userSelect });
  }

  return null;
}

async function firstBoardUser() {
  if (env.DATA_DRIVER === "json") {
    return localUsers(await listLocalUsers())[0] ?? null;
  }

  return prisma.user.findFirst({
    orderBy: { createdAt: "asc" },
    select: userSelect
  });
}

export async function resolveBoardActor(input: { actorUserId?: string | null; actorEmail?: string | null } = {}) {
  const userId = clean(input.actorUserId) ?? env.BOARD_MCP_DEFAULT_USER_ID;
  const email = clean(input.actorEmail) ?? env.BOARD_MCP_DEFAULT_USER_EMAIL;

  if (userId || email) {
    const user = await findBoardUser({ userId, email });

    if (!user) {
      throw new HttpError(404, "Usuario ator do MCP nao encontrado.");
    }

    return user;
  }

  const fallback = await firstBoardUser();

  if (!fallback) {
    throw new HttpError(422, "Nenhum usuario cadastrado para executar a acao MCP.");
  }

  return fallback;
}
