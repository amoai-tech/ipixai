# Mastra in iPix

Mastra owns **agents, tools, workflows, memory orchestration, and durable AI execution**. Supabase/Postgres remains the durable application source of truth; CopilotKit owns the operator-facing interactive AI layer.

## Current verified implementation

- Installed runtime: `@mastra/core@1.63.2` and `@mastra/pg@1.22.2`.
- Runtime entry points: `src/mastra/index.ts` and `src/mastra/runtime.ts`.
- Postgres storage setup: `src/mastra/pg-store.ts`.
- Agent registry: `src/mastra/agents/index.ts`.
- Current tools live under `src/mastra/tools/`.
- Current durable workflows include `src/mastra/workflows/brand-intelligence.ts` and `src/mastra/workflows/shoot-plan-review.ts`.
- Thread persistence helpers live in `src/mastra/thread-persistence.ts`.

## iPix rule

Use Mastra for AI orchestration, not as a second application database. Consequential writes require the authenticated operator boundary and human approval where appropriate.

## References

- [Mastra documentation](https://mastra.ai/docs)
- [Mastra GitHub repository](https://github.com/mastra-ai/mastra)
