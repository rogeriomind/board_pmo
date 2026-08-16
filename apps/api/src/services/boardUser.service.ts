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

function plain(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("pt-BR");
}

function matchesUser(user: BoardUser, query: string) {
  const target = plain(query);
  if (!target) return true;
  return plain(user.name).includes(target) || plain(user.email).includes(target);
}

export async function listBoardUsers() {
  if (env.DATA_DRIVER === "json") {
    return localUsers(await listLocalUsers()).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }

  return prisma.user.findMany({
    select: userSelect,
    orderBy: { name: "asc" }
  });
}

export async function searchBoardUsers(input: { query?: string | null; limit?: number | null }) {
  const limit = Math.max(1, Math.min(input.limit ?? 20, 100));
  const users = await listBoardUsers();
  return users.filter((user) => matchesUser(user, input.query ?? "")).slice(0, limit);
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
