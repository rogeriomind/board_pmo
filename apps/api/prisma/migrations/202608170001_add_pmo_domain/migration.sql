CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS "tenants" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "tenants_slug_key" ON "tenants"("slug");

CREATE TABLE IF NOT EXISTS "portfolios" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "portfolios_pkey" PRIMARY KEY ("id")
);

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
);

CREATE TABLE IF NOT EXISTS "idempotency_records" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "key" TEXT NOT NULL,
  "operation" TEXT NOT NULL,
  "resource_id" UUID,
  "response_payload" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "idempotency_records_pkey" PRIMARY KEY ("id")
);

INSERT INTO "tenants" ("id", "name", "slug", "active", "created_at", "updated_at")
VALUES ('00000000-0000-4000-8000-000000000001', 'Default Tenant', 'default-tenant', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET
  "name" = EXCLUDED."name",
  "slug" = EXCLUDED."slug",
  "active" = EXCLUDED."active",
  "updated_at" = CURRENT_TIMESTAMP;

INSERT INTO "portfolios" ("id", "tenant_id", "name", "description", "active", "created_at", "updated_at")
VALUES (
  '00000000-0000-4000-8000-000000000002',
  '00000000-0000-4000-8000-000000000001',
  'Default Portfolio',
  'Portfolio default para compatibilidade com atividades existentes.',
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("id") DO UPDATE SET
  "tenant_id" = EXCLUDED."tenant_id",
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "active" = EXCLUDED."active",
  "updated_at" = CURRENT_TIMESTAMP;

INSERT INTO "projects" ("id", "tenant_id", "portfolio_id", "name", "description", "status", "active", "created_at", "updated_at")
VALUES (
  '00000000-0000-4000-8000-000000000003',
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000002',
  'Projeto Geral',
  'Projeto default para compatibilidade com atividades existentes.',
  'ACTIVE',
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("id") DO UPDATE SET
  "tenant_id" = EXCLUDED."tenant_id",
  "portfolio_id" = EXCLUDED."portfolio_id",
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "status" = EXCLUDED."status",
  "active" = EXCLUDED."active",
  "updated_at" = CURRENT_TIMESTAMP;

ALTER TABLE "activities" ADD COLUMN IF NOT EXISTS "tenant_id" UUID;
ALTER TABLE "activities" ADD COLUMN IF NOT EXISTS "project_id" UUID;

UPDATE "activities"
SET
  "tenant_id" = COALESCE("tenant_id", '00000000-0000-4000-8000-000000000001'),
  "project_id" = COALESCE("project_id", '00000000-0000-4000-8000-000000000003');

ALTER TABLE "activities" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "activities" ALTER COLUMN "project_id" SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'portfolios_tenant_id_fkey'
  ) THEN
    ALTER TABLE "portfolios"
      ADD CONSTRAINT "portfolios_tenant_id_fkey"
      FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'projects_tenant_id_fkey'
  ) THEN
    ALTER TABLE "projects"
      ADD CONSTRAINT "projects_tenant_id_fkey"
      FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'projects_portfolio_id_fkey'
  ) THEN
    ALTER TABLE "projects"
      ADD CONSTRAINT "projects_portfolio_id_fkey"
      FOREIGN KEY ("portfolio_id") REFERENCES "portfolios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'projects_owner_id_fkey'
  ) THEN
    ALTER TABLE "projects"
      ADD CONSTRAINT "projects_owner_id_fkey"
      FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'activities_tenant_id_fkey'
  ) THEN
    ALTER TABLE "activities"
      ADD CONSTRAINT "activities_tenant_id_fkey"
      FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'activities_project_id_fkey'
  ) THEN
    ALTER TABLE "activities"
      ADD CONSTRAINT "activities_project_id_fkey"
      FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'idempotency_records_tenant_id_fkey'
  ) THEN
    ALTER TABLE "idempotency_records"
      ADD CONSTRAINT "idempotency_records_tenant_id_fkey"
      FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "portfolios_tenant_id_idx" ON "portfolios"("tenant_id");
CREATE INDEX IF NOT EXISTS "projects_tenant_id_idx" ON "projects"("tenant_id");
CREATE INDEX IF NOT EXISTS "projects_portfolio_id_idx" ON "projects"("portfolio_id");
CREATE INDEX IF NOT EXISTS "projects_tenant_id_updated_at_idx" ON "projects"("tenant_id", "updated_at");
CREATE INDEX IF NOT EXISTS "activities_tenant_id_project_id_idx" ON "activities"("tenant_id", "project_id");
CREATE INDEX IF NOT EXISTS "activities_project_id_status_idx" ON "activities"("project_id", "status");
CREATE INDEX IF NOT EXISTS "activities_project_id_assignee_id_status_idx" ON "activities"("project_id", "assignee_id", "status");
CREATE INDEX IF NOT EXISTS "activities_project_id_due_date_idx" ON "activities"("project_id", "due_date");
CREATE INDEX IF NOT EXISTS "activities_tenant_id_updated_at_idx" ON "activities"("tenant_id", "updated_at");
CREATE UNIQUE INDEX IF NOT EXISTS "idempotency_records_tenant_id_key_key" ON "idempotency_records"("tenant_id", "key");
CREATE INDEX IF NOT EXISTS "idempotency_records_tenant_id_operation_idx" ON "idempotency_records"("tenant_id", "operation");
