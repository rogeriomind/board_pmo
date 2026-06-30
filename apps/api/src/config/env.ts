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
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  DATA_DRIVER: z.enum(["json", "prisma"]).default("json")
});

export const env = envSchema.parse(process.env);
