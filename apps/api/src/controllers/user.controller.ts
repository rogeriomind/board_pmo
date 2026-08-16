import type { Request, Response } from "express";
import { listBoardUsers } from "../services/boardUser.service.js";

export async function listUsers(_request: Request, response: Response) {
  return response.json(await listBoardUsers());
}
