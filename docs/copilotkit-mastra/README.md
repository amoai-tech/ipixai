# CopilotKit × Mastra

CopilotKit is the operator-facing AI interface. Mastra owns agents, tools, workflows, memory orchestration, and resumable AI execution.

**Code source of truth:** `src/app/api/copilotkit/[[...slug]]/route.ts`, `src/mastra/`, and `package.json`.

## Current runtime family

Versions are written down in exactly one place: [Runtime compatibility family](../mastra/runtime-family.md). `package.json` and `package-lock.json` are the executable source of truth; this page deliberately restates no version so it cannot drift again.

## Current contracts

- Next.js / Vercel is the application host.
- The server derives the trusted operator, organization, and memory scope.
- Memory resource IDs use `org:{orgId}::user:{userId}` in current code.
- Hosted Mastra uses the approved Postgres store and fails closed when hosted storage is missing or unapproved.
- Supabase/Postgres owns durable application truth; Mastra does not bypass tenant authorization.
- Consequential domain writes require human review/approval.

## Read next

- [Verified upgrade roadmap](./06-copilotkit-mastra-upgrade.md)
- [Product requirements](../prd.md)
- [Runtime compatibility family](../mastra/runtime-family.md)
- [Postgres schema contract](../mastra/db-001-matrix.md)
- [Documentation map](../docs-index.md)
- [Historical AI plans and audits](../archive/copilotkit-mastra/)

Dated conversion plans, repo research, tool surveys, and old runtime audits are preserved in `docs/archive/`; they are not current runtime authority.
