# PMO domain notes

## JSON driver duplication

The Prisma/PostgreSQL path is the source of truth for the PMO domain evolution.

`apps/api/src/services/localStore.service.ts` still duplicates Activity business rules for local development and tests:

- Activity status transition validations.
- Checklist completion checks before `DONE`.
- History creation messages.
- Project/tenant default compatibility.
- Local idempotency persistence.

This was kept intentionally narrow to avoid a broad rewrite while introducing `Tenant -> Portfolio -> Project -> Activity`.
A future cleanup should remove duplicated business rules from the JSON driver or make it delegate to shared domain functions.
