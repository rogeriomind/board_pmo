import { spawnSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function exists(sql: string) {
  const rows = await prisma.$queryRawUnsafe<Array<{ exists: boolean }>>(sql);
  return Boolean(rows[0]?.exists);
}

async function tableExists(tableName: string) {
  return exists(`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = '${tableName}'
    ) AS "exists"
  `);
}

async function columnExists(tableName: string, columnName: string) {
  return exists(`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = '${tableName}'
        AND column_name = '${columnName}'
    ) AS "exists"
  `);
}

async function constraintExists(constraintName: string) {
  return exists(`
    SELECT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = '${constraintName}'
    ) AS "exists"
  `);
}

async function execute(statement: string) {
  await prisma.$executeRawUnsafe(statement);
}

async function addConstraintIfMissing(name: string, requiredTables: string[], statement: string) {
  const tablesReady = await Promise.all(requiredTables.map((table) => tableExists(table)));

  if (tablesReady.every(Boolean) && !(await constraintExists(name))) {
    await execute(statement);
  }
}

async function createIndexIfTableExists(tableName: string, statement: string) {
  if (await tableExists(tableName)) {
    await execute(statement);
  }
}

async function applyLegacyDomainPatch() {
  console.log("Applying PMO legacy database patch...");
  await execute(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);

  console.log("Ensuring PMO domain tables...");
  await execute(`
    CREATE TABLE IF NOT EXISTS "tenants" (
      "id" UUID NOT NULL DEFAULT gen_random_uuid(),
      "name" TEXT NOT NULL,
      "slug" TEXT NOT NULL,
      "active" BOOLEAN NOT NULL DEFAULT true,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
    )
  `);
  await execute(`CREATE UNIQUE INDEX IF NOT EXISTS "tenants_slug_key" ON "tenants"("slug")`);

  await execute(`
    CREATE TABLE IF NOT EXISTS "portfolios" (
      "id" UUID NOT NULL DEFAULT gen_random_uuid(),
      "tenant_id" UUID NOT NULL,
      "name" TEXT NOT NULL,
      "description" TEXT,
      "active" BOOLEAN NOT NULL DEFAULT true,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "portfolios_pkey" PRIMARY KEY ("id")
    )
  `);

  await execute(`
    CREATE TABLE IF NOT EXISTS "projects" (
      "id" UUID NOT NULL DEFAULT gen_random_uuid(),
      "tenant_id" UUID NOT NULL,
      "portfolio_id" UUID NOT NULL,
      "name" TEXT NOT NULL,
      "description" TEXT,
      "status" TEXT NOT NULL DEFAULT 'ACTIVE',
      "health" TEXT,
      "start_date" TIMESTAMP(3),
      "target_date" TIMESTAMP(3),
      "owner_id" UUID,
      "active" BOOLEAN NOT NULL DEFAULT true,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
    )
  `);

  await execute(`
    CREATE TABLE IF NOT EXISTS "idempotency_records" (
      "id" UUID NOT NULL DEFAULT gen_random_uuid(),
      "tenant_id" UUID NOT NULL,
      "key" TEXT NOT NULL,
      "operation" TEXT NOT NULL,
      "resource_id" UUID,
      "response_payload" JSONB NOT NULL,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "idempotency_records_pkey" PRIMARY KEY ("id")
    )
  `);

  console.log("Ensuring default tenant, portfolio and project...");
  await execute(`
    INSERT INTO "tenants" ("id", "name", "slug", "active")
    VALUES ('00000000-0000-4000-8000-000000000001', 'Default Tenant', 'default-tenant', true)
    ON CONFLICT ("id") DO UPDATE SET
      "name" = EXCLUDED."name",
      "slug" = EXCLUDED."slug",
      "active" = EXCLUDED."active",
      "updated_at" = CURRENT_TIMESTAMP
  `);

  await execute(`
    INSERT INTO "portfolios" ("id", "tenant_id", "name", "description", "active")
    VALUES (
      '00000000-0000-4000-8000-000000000002',
      '00000000-0000-4000-8000-000000000001',
      'Default Portfolio',
      'Portfolio default para compatibilidade com atividades existentes.',
      true
    )
    ON CONFLICT ("id") DO UPDATE SET
      "tenant_id" = EXCLUDED."tenant_id",
      "name" = EXCLUDED."name",
      "description" = EXCLUDED."description",
      "active" = EXCLUDED."active",
      "updated_at" = CURRENT_TIMESTAMP
  `);

  await execute(`
    INSERT INTO "projects" ("id", "tenant_id", "portfolio_id", "name", "description", "status", "active")
    VALUES (
      '00000000-0000-4000-8000-000000000003',
      '00000000-0000-4000-8000-000000000001',
      '00000000-0000-4000-8000-000000000002',
      'Projeto Geral',
      'Projeto default para compatibilidade com atividades existentes.',
      'ACTIVE',
      true
    )
    ON CONFLICT ("id") DO UPDATE SET
      "tenant_id" = EXCLUDED."tenant_id",
      "portfolio_id" = EXCLUDED."portfolio_id",
      "name" = EXCLUDED."name",
      "description" = EXCLUDED."description",
      "status" = EXCLUDED."status",
      "active" = EXCLUDED."active",
      "updated_at" = CURRENT_TIMESTAMP
  `);

  if (await tableExists("activities")) {
    console.log("Backfilling existing activities with default PMO scope...");
    if (!(await columnExists("activities", "tenant_id"))) {
      await execute(`ALTER TABLE "activities" ADD COLUMN "tenant_id" UUID`);
    }

    if (!(await columnExists("activities", "project_id"))) {
      await execute(`ALTER TABLE "activities" ADD COLUMN "project_id" UUID`);
    }

    await execute(`
      UPDATE "activities"
      SET
        "tenant_id" = COALESCE("tenant_id", '00000000-0000-4000-8000-000000000001'),
        "project_id" = COALESCE("project_id", '00000000-0000-4000-8000-000000000003')
    `);

    await execute(`ALTER TABLE "activities" ALTER COLUMN "tenant_id" SET NOT NULL`);
    await execute(`ALTER TABLE "activities" ALTER COLUMN "project_id" SET NOT NULL`);
  }

  console.log("Ensuring PMO foreign keys and indexes...");
  await addConstraintIfMissing(
    "portfolios_tenant_id_fkey",
    ["portfolios", "tenants"],
    `ALTER TABLE "portfolios" ADD CONSTRAINT "portfolios_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE`
  );
  await addConstraintIfMissing(
    "projects_tenant_id_fkey",
    ["projects", "tenants"],
    `ALTER TABLE "projects" ADD CONSTRAINT "projects_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE`
  );
  await addConstraintIfMissing(
    "projects_portfolio_id_fkey",
    ["projects", "portfolios"],
    `ALTER TABLE "projects" ADD CONSTRAINT "projects_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "portfolios"("id") ON DELETE RESTRICT ON UPDATE CASCADE`
  );
  await addConstraintIfMissing(
    "projects_owner_id_fkey",
    ["projects", "users"],
    `ALTER TABLE "projects" ADD CONSTRAINT "projects_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE`
  );
  await addConstraintIfMissing(
    "activities_tenant_id_fkey",
    ["activities", "tenants"],
    `ALTER TABLE "activities" ADD CONSTRAINT "activities_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE`
  );
  await addConstraintIfMissing(
    "activities_project_id_fkey",
    ["activities", "projects"],
    `ALTER TABLE "activities" ADD CONSTRAINT "activities_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE`
  );
  await addConstraintIfMissing(
    "idempotency_records_tenant_id_fkey",
    ["idempotency_records", "tenants"],
    `ALTER TABLE "idempotency_records" ADD CONSTRAINT "idempotency_records_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE`
  );

  await createIndexIfTableExists("portfolios", `CREATE INDEX IF NOT EXISTS "portfolios_tenant_id_idx" ON "portfolios"("tenant_id")`);
  await createIndexIfTableExists("projects", `CREATE INDEX IF NOT EXISTS "projects_tenant_id_idx" ON "projects"("tenant_id")`);
  await createIndexIfTableExists("projects", `CREATE INDEX IF NOT EXISTS "projects_portfolio_id_idx" ON "projects"("portfolio_id")`);
  await createIndexIfTableExists("projects", `CREATE INDEX IF NOT EXISTS "projects_tenant_id_updated_at_idx" ON "projects"("tenant_id", "updated_at")`);
  await createIndexIfTableExists("activities", `CREATE INDEX IF NOT EXISTS "activities_tenant_id_project_id_idx" ON "activities"("tenant_id", "project_id")`);
  await createIndexIfTableExists("activities", `CREATE INDEX IF NOT EXISTS "activities_project_id_status_idx" ON "activities"("project_id", "status")`);
  await createIndexIfTableExists("activities", `CREATE INDEX IF NOT EXISTS "activities_project_id_assignee_id_status_idx" ON "activities"("project_id", "assignee_id", "status")`);
  await createIndexIfTableExists("activities", `CREATE INDEX IF NOT EXISTS "activities_project_id_due_date_idx" ON "activities"("project_id", "due_date")`);
  await createIndexIfTableExists("activities", `CREATE INDEX IF NOT EXISTS "activities_tenant_id_updated_at_idx" ON "activities"("tenant_id", "updated_at")`);
  await createIndexIfTableExists("idempotency_records", `CREATE UNIQUE INDEX IF NOT EXISTS "idempotency_records_tenant_id_key_key" ON "idempotency_records"("tenant_id", "key")`);
  await createIndexIfTableExists("idempotency_records", `CREATE INDEX IF NOT EXISTS "idempotency_records_tenant_id_operation_idx" ON "idempotency_records"("tenant_id", "operation")`);
  console.log("PMO legacy database patch completed.");
}

function runPrismaDbPush() {
  const command = process.platform === "win32" ? "npx.cmd" : "npx";
  const result = spawnSync(
    command,
    ["prisma", "db", "push", "--schema", "prisma/schema.prisma", "--skip-generate"],
    {
      stdio: "inherit",
      shell: false
    }
  );

  if (result.status !== 0) {
    throw new Error(`prisma db push failed with exit code ${result.status ?? "unknown"}`);
  }
}

async function main() {
  await applyLegacyDomainPatch();
  await prisma.$disconnect();
  console.log("Synchronizing Prisma schema...");
  runPrismaDbPush();
  console.log("Database deploy completed.");
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
