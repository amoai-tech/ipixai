# CopilotKit × Mastra

CopilotKit is the operator-facing AI interface. Mastra owns agents, tools, workflows, memory orchestration, and resumable AI execution.

**Code source of truth:** `src/app/api/copilotkit/[[...slug]]/route.ts`, `src/mastra/`, and `package.json`.

## Current runtime

| Component | Current pin |
|---|---:|
| `@copilotkit/runtime` | 1.68.1 |
| `@copilotkit/react-core` | 1.68.1 |
| `@ag-ui/mastra` | 1.1.4 |
| `@mastra/core` | 1.63.2 |
| `@mastra/pg` | 1.22.2 |
| `@mastra/memory` | 1.28.1 |

## Current contracts

- Next.js / Vercel is the application host.
- The CopilotKit route derives the operator and memory resource scope server-side.
- Hosted Mastra uses the approved Postgres store and fails closed if hosted storage is missing or unapproved.
- Local development may use in-memory LibSQL when the hosted database URL is intentionally absent.
- Supabase owns durable domain truth; Mastra does not bypass tenant authorization.
- Consequential domain writes require human review/approval.

## Read next

- [Product requirements](../prd.md)
- [Mastra conversion contract](../mastra/10-mastra-convert.md)
- [Runtime compatibility family](../mastra/runtime-family.md)
- [Mastra / Supabase storage](../mastra/supabase-mastra.md)
- [Postgres schema contract](../mastra/db-001-matrix.md)
- [Documentation inventory](../DOCS-INDEX.md)

Historical CopilotKit/Mastra plans remain in Git for evidence and are listed in the documentation inventory, but they are not current runtime authority.
