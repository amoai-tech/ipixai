# 07 — Repo → task map

**After:** [06-example-adoption.md](./06-example-adoption.md)
**Before:** [08-custom-code-reduction.md](./08-custom-code-reduction.md)
**Parent:** PROPOSED **IPI-1028 · MASTRA-V2-000**  
All child IDs below are **PROPOSED** until created in Linear. One useful repo → at least one task. Do not mix Core persist with MCP in the same issue.

---

## Architecture mapping

```text
Next.js App Router
  ← examples/integrations/mastra (app shell)
  ← examples/shadcn + agentcn (chrome)
  ← v2/react (hooks)

CopilotKit
  ← v2/runtime/node (handler)
  ← integrations/mastra (MastraAgent.getLocalAgents)

AG-UI
  ← @ag-ui/mastra (from starter)
  ← canvas/mastra-pm + canvas/mastra (shared state)

Mastra
  ← iPix agents/tools (keep)
  ← template-agent-harness (memory/tasks/schedules patterns)
  ← template-browser-agent (Playwright later)

PostgresStore → Supabase schema mastra
  ← Mastra official storage (not CopilotKit Intelligence for Core)
  ← existing iPix grants / org resourceId (IPI-146)
```

| Layer | Primary repo | Secondary |
| ----- | ------------ | --------- |
| App/runtime | integrations/mastra | v2/runtime/node |
| API check | v2/react + v2/runtime | v2/next-pages-router (split process only) |
| Shared state | canvas/mastra-pm | canvas/mastra |
| GenUI/HITL | showcases/generative-ui | CopilotKit Mastra showcase |
| UI | examples/shadcn | agentcn |
| Memory/tasks/schedules | template-agent-harness | — |
| HITL UX (wrong kit) | assistant-ui/mastra-hitl | **ideas only** |
| MCP | open-mcp-client | Apify actor |
| Browser | template-browser-agent | OpenBot |
| Multi-agent | multi-agent-canvas UX | OpenBot |
| Workflows/ops | mastra-triage | workshops |
| Agent authoring | template-agent-builder | ui-dojo |

---

## Task table

| Task | Repo/example | Reuse | Deliverable | Success |
| ---- | ------------ | ----- | ----------- | ------- |
| **PROPOSED IPI-1028 · MASTRA-V2-000** — Select repos (this doc set) | All listed | Rankings | Docs in `docs/new-plan/` | Team agrees foundation |
| **PROPOSED IPI-1029 · AI-V2-001** — Clean CopilotKit + Mastra runtime | [integrations/mastra](https://github.com/CopilotKit/CopilotKit/tree/main/examples/integrations/mastra) | Starter app, `getLocalAgents` | Parallel app, official handler | send → stream |
| **PROPOSED IPI-1030 · AI-V2-002** — Lock current v2 APIs | [v2/runtime](https://github.com/CopilotKit/CopilotKit/tree/main/examples/v2/runtime) (`node`) + [v2/react](https://github.com/CopilotKit/CopilotKit/tree/main/examples/v2/react) | Handler + provider imports | No custom `runtime-v2-fetch` | Typecheck vs installed pkgs |
| **PROPOSED IPI-1031 · AI-V2-003** — PostgresStore persist + refresh | Mastra PG docs + existing `mastra.*` | Store config, threadId | SQL row + restore | TEST-123 survives refresh **and** process restart |
| **PROPOSED IPI-1032 · AI-V2-004** — Auth + org resourceId | iPix (not a CK example) | IPI-146 pattern | Thin auth wrapper only | 401/403; Org B cannot read Org A |
| **PROPOSED IPI-1033 · AI-V2-005** — Production Planner agent | iPix `production-planner` + starter agent slot | Prompts/tools | One agent in new runtime | Planner answers in stream |
| **PROPOSED IPI-1034 · AI-V2-010** — Planner shared state board | [canvas/mastra-pm](https://github.com/CopilotKit/CopilotKit/tree/main/examples/canvas/mastra-pm) | Zod state, AG-UI sync | Shoots/fittings board | AI change updates UI live |
| **PROPOSED IPI-1035 · AI-V2-011** — Canvas cards for shoot packets | [canvas/mastra](https://github.com/CopilotKit/CopilotKit/tree/main/examples/canvas/mastra) | Card CRUD + plan tools | Visual packet | Create/edit card via chat |
| **PROPOSED IPI-1036 · AI-V2-012** — GenUI approval cards | [showcases/generative-ui](https://github.com/CopilotKit/CopilotKit/tree/main/examples/showcases/generative-ui) | Static GenUI, `useHumanInTheLoop` | Talent/budget cards | Approve in UI, not only text |
| **PROPOSED IPI-1037 · AI-V2-013** — Operator chat chrome | [examples/shadcn](https://github.com/CopilotKit/CopilotKit/tree/main/examples/shadcn) + [agentcn](https://github.com/shadcn-labs/agentcn) | Layout/tokens | Chat matches iPix | Visual QA |
| **PROPOSED IPI-1038 · AI-V2-014** — Working memory + task list | [template-agent-harness](https://github.com/mastra-ai/template-agent-harness) | Memory + tasks APIs | Planner working memory | Restart restores brand/shoot fields |
| **PROPOSED IPI-1039 · AI-V2-015** — Shoot Wizard on v2 runtime | iPix workflow + v1/state-machine **ideas** | Existing wizard | Wizard HTTP + HITL gates | Resume after refresh |
| **PROPOSED IPI-1040 · AI-V2-016** — Brand Intelligence on v2 | iPix workflow + v1/research-canvas **ideas** | Existing BI | BI agent on clean runtime | No tokens in snapshots |
| **PROPOSED IPI-1041 · AI-V2-020** — MCP tools | [open-mcp-client](https://github.com/CopilotKit/CopilotKit/tree/main/examples/showcases/open-mcp-client) | MCP UX | Linear/Cloudinary MCP | One tool round-trip |
| **PROPOSED IPI-1042 · AI-V2-021** — Browser research | [template-browser-agent](https://github.com/mastra-ai/template-browser-agent) | Playwright agent | Gated crawl | Approval before navigate |
| **PROPOSED IPI-1043 · AI-V2-022** — AG-UI coworker (optional) | [OpenBot](https://github.com/CopilotKit/OpenBot) | Pre-approve + audit | Isolated coworker | Not on Core path |
| **PROPOSED IPI-1044 · AI-V2-023** — Multi-agent canvas | [multi-agent-canvas](https://github.com/CopilotKit/CopilotKit/tree/main/examples/showcases/multi-agent-canvas) | UX only | Planner+Brand+Production | Mastra agents, not LangGraph |
| **PROPOSED IPI-1045 · AI-V2-024** — Schedules / observability | agent-harness + Mastra exporter | Cron/task patterns | Prune snapshots first | No 6k trigger rows growth |
| **PROPOSED IPI-1046 · AI-V2-025** — Intelligence Threads drawer | integrations/mastra docker-compose.intelligence | Official Threads | Optional paid | Or leave off — no fake UI |
| **PROPOSED IPI-1047 · AI-V2-026** — Worker eval | v2/runtime/`cf-workers` | Official Workers handler | Repeat golden test | Only after Node Core green |

**Not a build task:** v1 examples, react-router, assistant-ui HITL (no IPI — skip).

---

## Phase tags

| Phase | Task IDs |
| ----- | -------- |
| CORE | 1029–1033 (1028 = plan) |
| MVP | 1034–1040 |
| ADVANCED | 1041–1047 |
