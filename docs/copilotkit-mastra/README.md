# CopilotKit × Mastra

CopilotKit is the operator-facing AI interface. Mastra owns agents, tools, workflows, memory orchestration, and resumable AI execution.

**Code source of truth:** `src/app/api/copilotkit/[[...slug]]/route.ts`, `src/mastra/`, and `package.json`.

## Current runtime family

The one maintained version table is [Runtime compatibility family](../mastra/runtime-family.md).
It follows the exact `package.json` and `package-lock.json` pins. Do not copy
retired versions from historical conversion documents.

## Current contracts

- Next.js / Vercel is the application host.
- The server derives the trusted operator, organization, and memory scope.
- Memory resource IDs use `org:{orgId}::user:{userId}` in current code.
- The Production Planner runs Mastra in-process inside the authenticated Next.js route; its approved PostgreSQL storage is explicitly configured with `disableInit: true` and must fail closed if unavailable.
- Supabase/Postgres owns durable application truth; Mastra does not bypass tenant authorization.
- Consequential domain writes require human review/approval.

## Read next

- [Product requirements](../prd.md)
- [Runtime compatibility family](../mastra/runtime-family.md)
- [Postgres schema contract](../mastra/db-001-matrix.md)
- [CopilotKit GenUI foundation audit and corrected plan](09-copilotkit-audit-plan.md)
- [Documentation map](../docs-index.md)
- [Historical AI plans and audits](../archive/copilotkit-mastra/)

Dated conversion plans, repo research, tool surveys, and old runtime audits are preserved in `docs/archive/`; they are not current runtime authority.
