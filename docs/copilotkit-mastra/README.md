# CopilotKit × Mastra

CopilotKit is the operator-facing AI interface. Mastra owns agents, tools, workflows, memory orchestration, and resumable AI execution.

**Code source of truth:** `src/app/api/copilotkit/[[...slug]]/route.ts`, `src/mastra/`, and `package.json`.

## Current runtime family

| Component | Current pin |
|---|---:|
| `@copilotkit/runtime` | 1.68.1 |
| `@copilotkit/react-core` | 1.68.1 |
| `@copilotkit/channels` | 0.9.0 |
| `@ag-ui/client` | 0.0.58 |
| `@ag-ui/mastra` | 1.1.4 |
| `@mastra/core` | 1.63.2 |
| `@mastra/memory` | 1.28.1 |
| `@mastra/pg` | 1.22.2 |
| `@mastra/client-js` | 1.42.4 |
| `mastra` | 1.27.2 |

## Current contracts

- Next.js / Vercel is the application host.
- The server derives the trusted operator, organization, and memory scope.
- Memory resource IDs use `org:{orgId}::user:{userId}` in current code.
- Hosted Mastra uses the approved Postgres store and fails closed when hosted storage is missing or unapproved.
- Supabase/Postgres owns durable application truth; Mastra does not bypass tenant authorization.
- Consequential domain writes require human review/approval.

## Read next

- [Product requirements](../prd.md)
- [Runtime compatibility family](../mastra/runtime-family.md)
- [Postgres schema contract](../mastra/db-001-matrix.md)
- [Documentation map](../index-docs.md)
- [Historical AI plans and audits](../archive/copilotkit-mastra/)

Dated conversion plans, repo research, tool surveys, and old runtime audits are preserved in `docs/archive/`; they are not current runtime authority.
