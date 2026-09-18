# 08 — Custom-code reduction plan

**Date:** 2026-08-23  
**After:** [07-repo-to-task-map.md](./07-repo-to-task-map.md)
**Before:** [09-build-plan.md](./09-build-plan.md)

Goal: replace iPix runtime glue with CopilotKit/Mastra/Supabase patterns. Keep fashion/production logic.

---

## Official replacements

| Current custom | Official / example | Custom still needed? | Why |
| -------------- | ------------------ | -------------------- | --- |
| 681-line Copilot route | integrations/mastra + v2/runtime/node `createCopilotRuntimeHandler` | Thin auth + org only (~50–80 lines) | Starter has no Supabase org ACL |
| `runtime-v2-fetch.ts` Express bypass | Import `@copilotkit/runtime/v2` on Node | No in Core | Shim exists for Workers |
| `InMemoryAgentRunner` as persist | Mastra Memory + PostgresStore | No | CK docs: self-managed persist via agent memory, not BYO Threads API |
| `withStreamIdleTimeout` | Official AG-UI SSE | Only if PG still hangs | Compensate after Core, don’t start with it |
| `emitInterruptOutcome` clone hack | `useHumanInTheLoop` (generative-ui / Mastra showcase) | No | Official HITL |
| CF context in Copilot route | Omit | No in Core | DNS/CDN stay; Worker later |
| Fake Intelligence Threads UI | Wire official Intelligence **or** hide UI | Don’t half-wire | License ≠ Threads |
| Custom `public.mastra_*` | Already gone; keep `mastra.*` | No | IPI-1011 |
| Second chat kit (assistant-ui) | CopilotKit | No | One UI |
| LangGraph from v1/travel, research-canvas, multi-agent-canvas | Mastra agents | No | Wrong framework |
| agent-harness shell/workspace | Don’t expose in SaaS | Yes: memory/task **ideas** only | Multi-tenant safety |
| OpenBot computer | Isolated ADV | Yes later | Not Core |

---

## Wrappers we can avoid

- Hono-on-Vercel + Express barrel workarounds  
- OpenNext `@mastra/pg` stubs  
- Dual Gemini auth header museum (keep **10 lines** only if Google still rejects Bearer+API key)  
- Dispatcher snapshot spam as “features”  
- Pages Router / v1 CopilotRuntime  

---

## Estimates

| Metric | Estimate | Notes |
| ------ | -------- | ----- |
| Business logic reuse (agents/tools/UI/data) | **~60%** | Keep Planner/BI/Wizard |
| Copilot **runtime** custom LOC vs today | **−65% to −75%** | 681 → ~80 + tests |
| Storage/CF branch custom | **−50%** in Core (delete Worker path) | Reintroduce only IPI-1047 |
| Expected overall custom-code reduction (AI runtime slice) | **~70%** | Not 70% of whole iPix app |
| Whole-monorepo custom reduction | **~15–25%** | Most of the app is not Copilot |

If Core still needs a 400-line route, we failed the “use the starter” test.

---

## Feature → already solved?

| Feature | Solved by | Custom? |
| ------- | --------- | ------- |
| Runtime route | CK starter | Auth only |
| Streaming | AG-UI | No |
| Shared state | mastra-pm | Schema mapping |
| GenUI | generative-ui | iPix card components |
| HITL | CK `useHumanInTheLoop` + Mastra suspend | Wire, don’t invent |
| Thread persist Core | Mastra PG + threadId | Org ACL |
| Rich Threads drawer | CopilotKit Intelligence | Config or skip |
| MCP | open-mcp-client | Server list |
| Auth | Supabase | Existing |
| RAG | Mastra + later templates | Not Core |
