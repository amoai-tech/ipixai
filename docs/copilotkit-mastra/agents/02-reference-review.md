# 02 — Official Mastra Agent References Reviewed for iPix

**Reviewed:** November 22, 2026. External references were retrieved using Firecrawl developer search and current official Mastra pages. **Source of truth for implementation remains installed iPix 1.84 types and current main.** This reference review is not code or runtime certification.

| Official source | Verified behavior / example | Decision for iPix | Risk / test before adopting |
| --- | --- | --- | --- |
| [Agents overview](https://mastra.ai/docs/agents/overview) | Agents handle open-ended reasoning; workflows handle predefined multi-step work; agents use structured tools | Keep one Production Planner/Concierge for interpretation; keep Brand and Shoot flows in existing Mastra workflows | Never turn an existing durable workflow into a nondurable agent loop |
| [Supervisor / Subagents](https://mastra.ai/docs/agents/supervisor-agents) | Parent Agent can register specialist agents using its **agents** property, use description/instructions for selection, and call delegate through generate/stream | First try one nested specialist behind the current **default** registered Planner; no new top-level Copilot registry | Installed 1.84 typing, stream result shape, abort and current AG-UI adapter must be tested |
| [Agent tools](https://mastra.ai/docs/agents/tools) | Tools are typed functions, can include subagents or workflows as tools; tool execution context includes requestContext and abortSignal | Reuse existing seven Planner tools and activeTools gate, selected by actual task; no blanket tool access | Model tool selection is not user authorization; server reauthorizes all domain reads/writes |
| [Agent memory](https://mastra.ai/docs/agents/agent-memory) | Subagent delegation derives new memory resource/thread identifiers and may inherit parent Memory configuration | Verify iPix user/org resourceId and delegated memory content under actual storage | Do not assume same parent thread ID; prove isolation and restart with two org users |
| [Agent approval](https://mastra.ai/docs/agents/agent-approval) | Supervisor tool calls and subagent requests can involve approval/suspend/resume | Preserve existing exact Shoot review/RPC rather than create an independent approval backend | Must prove exact artifact revision, resumed action, idempotency and negative auth |
| [Connections/MCP](https://mastra.ai/docs/connections/mcp) | MCPClient retrieves external tools, MCPServer exposes selected capabilities to external clients | Only when cross-process/provider interop brings actual value; task owner [IPI-1485](https://linear.app/amo100/issue/IPI-1485) | Compare SDK/native tool first; pin compatible MCP version, scoped credentials, provider outage |
| [Subagent tool behavior](https://mastra.ai/docs/subagents) | Subagent may not run client tools that lack execute; pending tool calls must be handled by parent | Keep CopilotKit client-side render/HITL tools at parent layer until proved | Test unresolved client tool handling in actual AG-UI stream before delegation |

## Current iPix implementation facts

1. **Only one top-level agent today:** [src/mastra/runtime.ts](https://github.com/amoai-tech/ipixai/blob/main/src/mastra/runtime.ts) registers a single default Production Planner plus the two native workflows.
2. **The bridge is deliberately single-agent:** [src/agent.ts](https://github.com/amoai-tech/ipixai/blob/main/src/agent.ts) rejects 0 or multiple registered agents through withPlannerAgentId. Naively adding separate top-level Studio agents will break the product bridge.
3. **The product auth boundary already exists:** [CopilotKit route](https://github.com/amoai-tech/ipixai/blob/main/src/app/api/copilotkit/%5B%5B...slug%5D%5D/route.ts) derives org and resourceId at the server, passes one local agent into the existing CopilotKit runtime and uses the existing abort runner.
4. **Business-domain truth is separate from agents:** Brand profile, Shoots, CRM, Products and Assets remain in their existing services and Supabase records. A specialist must query authorized current data and return actual evidence, not invent facts.
5. **Installed dependency mismatch:** GitHub main manifest and lockfile pin Mastra Core 1.84.0 / PG 1.37.0; an older checkout's node_modules had 1.71.0 / PG 1.27.1. Latest official examples are not automatically executable in that old install.

## Core vs Advanced — do not overbuild

| Layer | Core | Advanced / only when justified |
| --- | --- | --- |
| Agent coordination | One default parent and a single small native delegation proof | Multiple specialist roles, custom delegation hooks, parallel coordination |
| Tools | Existing source-backed tools and strict activeTools selection | One external provider MCP after real interop/cost comparison |
| Memory | Existing approved Postgres and scoped operator resource IDs | Deliberately shared inter-agent knowledge only after data isolation tests |
| UI | Existing CopilotKit v2 chat and truthful cards, review buttons | Extra workspaces after genuine product needs, not duplicate providers |
| Workflows | Existing Brand Intelligence and Shoot Plan review workflow | Durable long-running orchestration and optimization only after measured issue |
| Verification | Authenticated real question, wrong-org denial, one persisted reviewed result | Agent evals, latency/cost, advanced recovery and load tests |

## Concrete negative tests

- Org A Brand DNA must not be visible from Org B even if the user guesses an ID or the model asks a subagent to “ignore rules.”
- The same user question must not trigger a paid crawl, publish an image, change a Brand profile or save a Shoot without the existing authorized exact-action path.
- A simulated web page containing tool instructions must be treated as untrusted data, not authority to execute new tools.
- Refresh, Stop, process restart and duplicate callback must not cause ghost progress or duplicate records.
- A subagent that cannot run a CopilotKit client-only tool must not be documented as having successfully completed the action.
- An unconfigured external provider must return an honest missing/unavailable result; no invented product inventory, prices, bookings or citations.

**Implementation owner:** [IPI-1473](https://linear.app/amo100/issue/IPI-1473) and its existing child issues. This reference review adds **no** agents, new tasks, runtime packages or external integrations.