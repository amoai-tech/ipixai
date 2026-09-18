# 06 — CopilotKit example adoption plan

**Date:** 2026-08-23  
**After:** [05-starter-decision.md](./05-starter-decision.md)
**Before:** [07-repo-to-task-map.md](./07-repo-to-task-map.md)
**Docs checked:** [CopilotKit Mastra quickstart](https://docs.copilotkit.ai/integrations/mastra/quickstart) (live MCP) + [04-example-catalog.md](../../notes/04-example-catalog.md)
**Packages in iPix today:** `@copilotkit/runtime` / `react-core` **1.61.2**, `@ag-ui/mastra` **1.1.1**

Rule: **one starter, then borrow features**. Do not Frankenstein ten examples.

Official Core route (current docs — prefer this over the Hono+Express skill snippet):

```ts
import {
  CopilotRuntime,
  createCopilotRuntimeHandler,
  InMemoryAgentRunner,
} from "@copilotkit/runtime/v2";
import { MastraAgent } from "@ag-ui/mastra";
import { mastra } from "@/mastra";

const runtime = new CopilotRuntime({
  agents: MastraAgent.getLocalAgents({ mastra }),
  runner: new InMemoryAgentRunner(),
});

const handler = createCopilotRuntimeHandler({
  runtime,
  basePath: "/api/copilotkit",
});

export const GET = handler;
export const POST = handler;
```

**Core persistence:** replace process-local runner replay with **Mastra `PostgresStore` + Memory** (already in iPix). Do not build a custom Supabase thread table. CopilotKit Intelligence threads are **MVP+**, not Core.

---

## Example scorecard

Path names follow the CopilotKit monorepo. Older docs said `examples/integrations/mastra`; current tree also uses `examples/integrations/mastra`. Use whatever `main` contains — **verify path on clone**. Do not use `examples/v1/*`.

| Example | Feature | Why useful | Copy / adapt | Do not copy | Score |
| ------- | ------- | ---------- | ------------ | ----------- | ----: |
| **`examples/integrations/mastra`** | Next.js + in-process Mastra + CopilotKit | Official “CopilotKit <> Mastra” starter | App skeleton, `getLocalAgents`, provider, sidebar | Demo weather agent, LibSQL `:memory:` | **98** |
| **`examples/v2/runtime`** | Current runtime APIs | Guard against stale Hono/Express patterns | `createCopilotRuntimeHandler`, runner wiring | Workers/OpenNext hacks | **91** |
| **`examples/v2/react`** | Provider, `useAgent`, chat | Confirm v2 imports (`/v2` subpath) | Provider + agentId contract | Unrelated demo UI | **91** |
| **`examples/canvas/mastra-pm`** | Shared state, working memory, board | Planner board updates when AI changes fittings | Zod shared state ↔ Mastra working memory | In-memory storage | **95** |
| **`examples/showcases/generative-ui`** | GenUI + HITL cards | Approval cards instead of walls of text | Static GenUI + `useHumanInTheLoop` | Unbounded A2UI / MCP Apps in Core | **94** |
| **`examples/shadcn`** | shadcn + Copilot chrome | Chat must look like iPix, not a bolted widget | Component/spacing patterns | Backend | **92** |
| `examples/showcases/open-mcp-client` | MCP tools in UI | Linear/Cloudinary later | MCP connection UX | Core | **87** |
| `examples/showcases/multi-agent-canvas` | Multi-agent one canvas | Planner + Brand + Production | Orchestration UX | Phase 1 | **89** |
| `examples/showcases/a2a-travel` | A2A | External specialist agents | Ideas only | Phase 1 | **80** |
| `examples/showcases/claude-managed-agents` | Delegation | Sub-agents | Ideas; Mastra already orchestrates | New orchestrator | **82** |

**If `integrations/mastra` and `v2/*` disagree:** stop and check live docs + installed types. That is how iPix accumulated shims last time.

**Skip:** `examples/v1/*`, Pydantic/LangGraph canvases, `canvas/pydantic-ai`. `canvas/mastra` is secondary to `integrations/mastra`.

---

## Custom glue → official alternative

| Current custom code | Official alternative | Replace? | Benefit |
| ------------------- | -------------------- | -------- | ------- |
| 681-line `route.ts` (ALS, URL thread parse, body tee, 5xx JSON rewrite) | `createCopilotRuntimeHandler` + thin auth wrapper | **Yes** (Core) | Maintainability |
| `runtime-v2-fetch.ts` Express bypass | Import `@copilotkit/runtime/v2` on **Node** | **Yes** (Core) | Delete Workers-only constraint |
| `InMemoryAgentRunner` as persist | Mastra Memory + PostgresStore; later CopilotKit Intelligence | **Yes** | Survive restart |
| `withStreamIdleTimeout` | Official SSE; add timeout only if still hangs | **Mostly** | Fewer stream bugs |
| `emitInterruptOutcome` config mutation | Official HITL / `useHumanInTheLoop` + Mastra suspend | **Yes** (MVP) | Proven resume |
| Bearer strip for Gemini dual-auth | Keep **tiny** header filter if Google still rejects dual auth | **Keep 10 lines if still required** | Don’t send operator JWT to Google |
| Org `resourceId` + `assertThreadOwnership` | Keep as **iPix auth** (Mastra does not enforce ACL) | **Keep** | Tenant safety |
| CF `getCloudflareContext` / Hyperdrive ALS in Copilot route | Omit until Worker eval | **Yes** (Core) | One runtime |
| Intelligence flags that never construct `CopilotKitIntelligence` | Wire official Intelligence **or** leave threads off | **MVP+** | No fake Threads UI |
| Custom `public` thread tables | Not needed — `mastra.mastra_threads` / `_messages` | **Do not add** | IPI-1020 rule |

**Target:** cut **~65–75%** of Copilot/Mastra **runtime** custom code. Keep **~60%** of product code (agents, tools, UI, RLS app data).

---

## Feature mapping (iPix)

| iPix need | Example | When |
| --------- | ------- | ---- |
| Clean app | `integrations/mastra` + `v2/runtime` + `v2/react` | Core |
| Gemini | Swap OpenAI in starter → `@ai-sdk/google` (already in iPix) | Core |
| Login | Existing Supabase Auth (not in examples) | Core |
| Persist TEST-123 | Mastra PostgresStore (Mastra docs, not Copilot example storage) | Core |
| Planner tools + board | `canvas/mastra-pm` | MVP |
| Approval cards | `generative-ui` | MVP |
| Visual system | `shadcn` | MVP |
| MCP / multi-agent / A2A | showcases listed above | Advanced |

---

## Verify against installed types (before copy-paste)

1. `MastraAgent.getLocalAgents` vs older `getLocalAgents` naming — **installed `@ag-ui/mastra@1.1.1` uses `getLocalAgents`**.
2. Handler: live docs = `createCopilotRuntimeHandler`; some skill assets still show `createCopilotHonoHandler` + `hono/vercel`. **Node Core uses fetch handler.**
3. Runner: examples still ship `InMemoryAgentRunner`. **That is fine for stream connectivity; it is not the persistence story.** Persistence is Mastra PG.

---

## Anti-patterns (why v2 exists)

- Mixing CopilotKit v1 GraphQL runtime with v2 AG-UI.
- Copying iPix Worker shims into a greenfield app “just in case.”
- Treating CopilotKit Intelligence as required for Core (it is licensed, extra env, currently unwired).
- Building a second thread store in `public`.
