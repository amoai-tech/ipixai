# Mastra in iPix

Mastra owns the **AI execution layer** in iPix: agents, typed tools, durable workflows, memory orchestration, suspend/resume, retries, and runtime state. Supabase/Postgres remains the durable application and tenant truth; CopilotKit owns the operator-facing interactive experience.

## Start here

| Need | Read |
| --- | --- |
| Runtime ownership and boundaries | [Architecture](./ARCHITECTURE.md) |
| Agent responsibilities | [Agents](./AGENTS.md) |
| Typed tool contracts and authorization | [Tools](./TOOLS.md) |
| Durable suspend/resume flows | [Workflows](./WORKFLOWS.md) |
| Memory scope and truth boundaries | [Memory](./MEMORY.md) |
| Postgres/runtime storage | [Storage](./STORAGE.md) |
| Deployment, retries, recovery, upgrades | [Operations](./OPERATIONS.md) |
| Known failures and fixes | [Troubleshooting](./TROUBLESHOOTING.md) |
| Smallest required foundation | [Core PRD](./mastra-core-prd.md) |
| Product-facing MVP | [MVP PRD](./mastra-mvp-prd.md) |
| Later automation/delegation | [Advanced PRD](./mastra-advanced-prd.md) |
| Proven patterns to reuse | [Reuse](./reuse.md) |
| Readiness evidence | [Progress](./progress.md) |

## Documentation status

This page is the navigation hub. Several detailed Mastra pages are still drafts/placeholders and must not be treated as verified implementation truth until they contain current code/runtime evidence.

## iPix rule

Mastra may propose or prepare consequential work, but approval-sensitive writes stay human-governed. Current code/runtime, tests, installed package types, and accepted architecture decisions override historical planning docs. Linear owns live task status and blockers.
