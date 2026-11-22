# CopilotKit × Mastra

CopilotKit is the operator-facing AI interface. Mastra owns agents, tools, workflows, memory orchestration, and resumable AI execution.

**Start here — AI Platform:** [Verified Progress Task Tracker (Agents, Workflows, MCP, Knowledge)](00-ai-platform-progress-tracker.md) · [Mastra Knowledge Product Plan](knowledge/README.md) · [Agents epic](https://linear.app/amo100/issue/IPI-1473) · [Workflows roadmap PR](https://github.com/amoai-tech/ipixai/pull/368) · [Tools roadmap PR](https://github.com/amoai-tech/ipixai/pull/369) · [Product-Agent MCP roadmap PR](https://github.com/amoai-tech/ipixai/pull/370).

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
