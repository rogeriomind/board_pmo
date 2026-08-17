export const DEFAULT_TENANT_ID = "00000000-0000-4000-8000-000000000001";
export const DEFAULT_PORTFOLIO_ID = "00000000-0000-4000-8000-000000000002";
export const DEFAULT_PROJECT_ID = "00000000-0000-4000-8000-000000000003";

export const DEFAULT_TENANT_NAME = "Default Tenant";
export const DEFAULT_TENANT_SLUG = "default-tenant";
export const DEFAULT_PORTFOLIO_NAME = "Default Portfolio";
export const DEFAULT_PROJECT_NAME = "Projeto Geral";

export type PmoScopeInput = {
  tenantId?: string | null;
  projectId?: string | null;
};

export type PmoScope = {
  tenantId: string;
  projectId: string;
};

export function withDefaultPmoScope(scope: PmoScopeInput = {}): PmoScope {
  return {
    tenantId: scope.tenantId ?? DEFAULT_TENANT_ID,
    projectId: scope.projectId ?? DEFAULT_PROJECT_ID
  };
}
