import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { z } from "zod";

const currentDir = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: path.resolve(currentDir, "../../../../.env") });
dotenv.config();

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(16).default("development-secret-change-me"),
  PORT: z.coerce.number().default(3333),
  MCP_HOST: z.string().default("127.0.0.1"),
  MCP_PORT: z.coerce.number().default(8011),
  MCP_PATH: z.string().default("/mcp"),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  DATA_DRIVER: z.enum(["json", "prisma"]).default("json"),
  BOARD_MCP_DEFAULT_USER_ID: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().uuid().optional()
  ),
  BOARD_MCP_DEFAULT_USER_EMAIL: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().email().optional()
  )
});

export const env = envSchema.parse(process.env);
