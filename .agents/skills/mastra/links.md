---
title: Mastra doc URL index
impact: HIGH
impactDescription: Canonical links aligned with mastra.ai/llms.txt
tags: mastra, docs, llms.txt, links
---

# Mastra — doc & link index

## Contents

- [Shared with Supatabs (curated quick index)](#shared-with-supatabs-curated-quick-index)
- [Canonical entry points](#canonical-entry-points)
- [GitHub — curated top repos](#github--curated-top-repos)
- [Web search (official guide)](#web-search-official-guide)
- [Getting started](#getting-started)
- [Studio](#studio)
- [Editor (stored agents, prompts, tools)](#editor-stored-agents-prompts-tools)
- [Agent Builder (managed stored agents — Phase 2+ for mdeai)](#agent-builder-managed-stored-agents--phase-2-for-mdeai)
- [Agents](#agents)
- [Harness & Agent Controller](#harness--agent-controller)
- [Workflows](#workflows)
- [Memory](#memory)
- [Tools (docs + reference)](#tools-docs--reference)
- [RAG](#rag)
- [Server & client](#server--client)
- [Auth & identity](#auth--identity)
- [MCP & workspaces](#mcp--workspaces)
- [Streaming](#streaming)
- [Observability & evals](#observability--evals)
- [Deployment](#deployment)
- [Models](#models)
- [Guides — app stacks](#guides--app-stacks)
- [Examples v0 (historical — verify compatibility before use)](#examples-v0-historical--verify-compatibility-before-use)
- [Browser automation](#browser-automation)
- [Mastra platform (managed)](#mastra-platform-managed)
- [Build with AI & community](#build-with-ai--community)
- [Reference — workflows](#reference--workflows)
- [Reference — streaming](#reference--streaming)
- [Reference — browser](#reference--browser)
- [Reference — tools, auth](#reference--tools-auth)


Single bookmark page for `.agents/skills/mastra`. **Task → section mapping:** [`references/topic-routing.md`](references/topic-routing.md). **Authoritative full tree:** [mastra.ai/llms.txt](https://mastra.ai/llms.txt) (regenerate this file when major nav sections change).

**Version-accurate code:** with packages installed, prefer **embedded** docs under `node_modules/@mastra/*/dist/docs/` (see [references/embedded-docs.md](references/embedded-docs.md)).

**Agent-friendly fetch:** append **`.md`** to most doc URLs for clean markdown (no site chrome).

---

## Shared with Supatabs (curated quick index)

**Historical material archived:** [legacy MDE/Supatabs links](../../../docs/archive/mastra/mastra-links-legacy-mde-supatabs.md). Do not load that cross-project reference for everyday iPix coding or treat v0 examples as executable current APIs.

**Legacy MDE concierge (archive only):** [docs/archive/mastra/mdeai-concierge.md](../../../docs/archive/mastra/mdeai-concierge.md). This is not the iPix implementation.

**iPix-first lookup:** [`references/README.md`](references/README.md) → [current runtime family](../../../docs/mastra/runtime-family.md) and installed source/types → [official Mastra docs index](https://mastra.ai/llms.txt). The [production-release procedure](../../../docs/production-release.md) owns release approval.

## Canonical entry points

| Resource | URL |
| --- | --- |
| **Full doc index / nav (start here)** | https://mastra.ai/llms.txt |
| **Docs home** | https://mastra.ai/docs |
| **Guides hub** | https://mastra.ai/guides |
| **Reference root** | https://mastra.ai/reference |
| **Models hub** | https://mastra.ai/models |
| **`mastra-ai` org (all repos)** | https://github.com/orgs/mastra-ai/repositories?type=all |
| **Templates** | https://mastra.ai/templates |

---

## GitHub — curated top repos

**Browse everything in the org:** [github.com/orgs/mastra-ai/repositories?type=all](https://github.com/orgs/mastra-ai/repositories?type=all)

| # | Repository | URL | Role |
| --- | --- | --- | --- |
| 1 | **mastra** | https://github.com/mastra-ai/mastra | Core framework (`@mastra/core`, CLI, runtime) |
| 2 | **skills** | https://github.com/mastra-ai/skills | Official agent/coding skills for Mastra |
| 3 | **workshops** | https://github.com/mastra-ai/workshops | Workshop collection |
| 4 | **workshop-mastra-editor** | https://github.com/mastra-ai/workshop-mastra-editor | Mastra Editor workshop |
| 5 | **mastra-agent-course** | https://github.com/mastra-ai/mastra-agent-course | Agent course material |
| 6 | **ui-dojo** | https://github.com/mastra-ai/ui-dojo | UI patterns (AI SDK, Assistant UI, CopilotKit, …) |
| — | **UI Dojo (live)** | https://ui-dojo.mastra.ai/ | Runnable CopilotKit + Mastra examples |
| 7 | **docs-chatbot-example** | https://github.com/mastra-ai/docs-chatbot-example | RAG / docs chatbot template |
| 8 | **personal-assistant-example** | https://github.com/mastra-ai/personal-assistant-example | Assistant + MCP example |
| 9 | **mastra-mcp-workshop** | https://github.com/mastra-ai/mastra-mcp-workshop | MCP workshop |
| 10 | **actor-mastra-mcp-agent** (Apify) | https://github.com/apify/actor-mastra-mcp-agent | Community: Apify Actor + Mastra MCP *(outside `mastra-ai` org)* |

**Apify platform docs (Mastra integration):** https://docs.apify.com/platform/integrations/mastra

### Upstream issues (core framework)

| Resource | URL |
| --- | --- |
| **`mastra-ai/mastra` issues** (bugs, regressions, feature triage) | https://github.com/mastra-ai/mastra/issues |

Check here when smoke tests fail on a **clean** repro but match an upstream pattern (storage, Zod/structured output, workflows, tools). Volume is high — filter by label and `is:issue is:open` before deep-diving.

---

## Web search (official guide)

Hands-on pattern for adding a **web search** tool to an agent (not “use Google in the browser”):

| Resource | URL |
| --- | --- |
| **Web search tool** (guides / tutorial) | https://mastra.ai/guides/guide/web-search |

See also **Guides — tutorials** below (same link, grouped with other hands-on guides).

---

## Getting started

| Topic | URL |
| --- | --- |
| Get started (root) | https://mastra.ai/docs |
| Project structure | https://mastra.ai/docs/getting-started/project-structure |
| Manual install | https://mastra.ai/docs/getting-started/manual-install |
| Build with AI | https://mastra.ai/docs/getting-started/build-with-ai |

---

## Studio

| Topic | URL |
| --- | --- |
| Overview | https://mastra.ai/docs/studio/overview |
| Deployment | https://mastra.ai/docs/studio/deployment |
| Auth | https://mastra.ai/docs/studio/auth |
| Observability | https://mastra.ai/docs/studio/observability |

---

## Editor (stored agents, prompts, tools)

| Topic | URL |
| --- | --- |
| Overview | https://mastra.ai/docs/editor/overview |
| Tools | https://mastra.ai/docs/editor/tools |
| Prompts | https://mastra.ai/docs/editor/prompts |
| MastraEditor (reference) | https://mastra.ai/reference/editor/mastra-editor |

---

## Agent Builder (managed stored agents — Phase 2+ for mdeai)

| Topic | URL |
| --- | --- |
| Overview | https://mastra.ai/docs/agent-builder/overview |
| Configuration | https://mastra.ai/docs/agent-builder/configuration |
| Memory | https://mastra.ai/docs/agent-builder/memory |
| Workspace | https://mastra.ai/docs/agent-builder/workspace |
| Channels | https://mastra.ai/docs/agent-builder/channels |
| Skill registries | https://mastra.ai/docs/agent-builder/skill-registries |
| Deploying | https://mastra.ai/docs/agent-builder/deploying |

---

## Agents

| Topic | URL |
| --- | --- |
| Overview | https://mastra.ai/docs/agents/overview |
| Using tools | https://mastra.ai/docs/agents/using-tools |
| Structured output | https://mastra.ai/docs/agents/structured-output |
| Supervisor agents | https://mastra.ai/docs/agents/supervisor-agents |
| Background tasks | https://mastra.ai/docs/agents/background-tasks |
| Adding voice | https://mastra.ai/docs/agents/adding-voice |
| Processors | https://mastra.ai/docs/agents/processors |
| Guardrails | https://mastra.ai/docs/agents/guardrails |
| Agent approval | https://mastra.ai/docs/agents/agent-approval |
| Response caching | https://mastra.ai/docs/agents/response-caching |
| Networks | https://mastra.ai/docs/agents/networks |
| Channels (older path; use canonical row below) | https://mastra.ai/docs/agents/channels |
| A2A (older path; use Connections canonical) | https://mastra.ai/docs/agents/a2a |
| ACP (older path; use Connections canonical) | https://mastra.ai/docs/agents/acp |
| Signals | https://mastra.ai/docs/agents/signals |
| **Code Mode** | https://mastra.ai/docs/agents/code-mode |
| **Subagents (current)** | https://mastra.ai/docs/subagents |
| **Skills (current)** | https://mastra.ai/docs/skills |
| **Channels (current canonical)** | https://mastra.ai/docs/channels |

---

## Harness & Agent Controller

| Topic | URL |
| --- | --- |
| Harness overview | https://mastra.ai/docs/harness/overview |
| Agent Controller | https://mastra.ai/docs/harness/agent-controller |
| Durable agents | https://mastra.ai/docs/harness/durable-agents |
| Background tasks | https://mastra.ai/docs/harness/background-tasks |
| Goals | https://mastra.ai/docs/harness/goals |
| Schedules | https://mastra.ai/docs/harness/schedules |
| Signals | https://mastra.ai/docs/harness/signals |

**iPix:** optional/advanced. Use only when the product needs a long-running, steerable interactive agent experience with sessions/modes/approvals/subagents. Do not put this on Planner Core by default.

---

## Workflows

| Topic | URL |
| --- | --- |
| Overview | https://mastra.ai/docs/workflows/overview |
| Workflow state | https://mastra.ai/docs/workflows/workflow-state |
| Control flow | https://mastra.ai/docs/workflows/control-flow |
| Agents & tools in workflows | https://mastra.ai/docs/workflows/agents-and-tools |
| **Dynamic workflows** | https://mastra.ai/docs/workflows/dynamic-workflows |
| Snapshots | https://mastra.ai/docs/workflows/snapshots |
| Suspend & resume | https://mastra.ai/docs/workflows/suspend-and-resume |
| Human-in-the-loop | https://mastra.ai/docs/workflows/human-in-the-loop |
| Time travel | https://mastra.ai/docs/workflows/time-travel |
| Scheduled workflows | https://mastra.ai/docs/workflows/scheduled-workflows |
| Error handling | https://mastra.ai/docs/workflows/error-handling |

---

## Memory

| Topic | URL |
| --- | --- |
| Overview | https://mastra.ai/docs/memory/overview |
| Storage | https://mastra.ai/docs/memory/storage |
| Message history | https://mastra.ai/docs/memory/message-history |
| Working memory | https://mastra.ai/docs/memory/working-memory |
| Observational memory | https://mastra.ai/docs/memory/observational-memory |
| Memory processors | https://mastra.ai/docs/memory/memory-processors |
| Semantic recall | https://mastra.ai/docs/memory/semantic-recall |
| Multi-user threads | https://mastra.ai/docs/memory/multi-user-threads |

---

## Tools (docs + reference)

| Topic | URL |
| --- | --- |
| Tools overview (see also Agents → using tools) | https://mastra.ai/docs/tools/overview |
| Creating tools | https://mastra.ai/docs/tools/creating-tools |
| **`createTool()` (reference)** | https://mastra.ai/reference/tools/create-tool |

---

## RAG

| Topic | URL |
| --- | --- |
| Overview | https://mastra.ai/docs/rag/overview |
| Chunking and embedding | https://mastra.ai/docs/rag/chunking-and-embedding |
| Vector databases | https://mastra.ai/docs/rag/vector-databases |
| Retrieval | https://mastra.ai/docs/rag/retrieval |
| GraphRAG | https://mastra.ai/docs/rag/graph-rag |

---

## Server & client

| Topic | URL |
| --- | --- |
| Mastra server | https://mastra.ai/docs/server/mastra-server |
| Server adapters | https://mastra.ai/docs/server/server-adapters |
| Custom adapters | https://mastra.ai/docs/server/custom-adapters |
| Middleware | https://mastra.ai/docs/server/middleware |
| Mastra Client (concept) | https://mastra.ai/docs/server/mastra-client |
| Request context | https://mastra.ai/docs/server/request-context |
| Custom API routes | https://mastra.ai/docs/server/custom-api-routes |
| **Pub/Sub event system** | https://mastra.ai/docs/server/pubsub |
| Auth — Supabase (legacy server path; verify redirect/current provider docs) | https://mastra.ai/docs/server/auth/supabase |
| Auth — JWT (legacy server path; verify redirect/current auth docs) | https://mastra.ai/docs/server/auth/jwt |

---

## Auth & identity

| Topic | URL |
| --- | --- |
| **Auth overview (current)** | https://mastra.ai/docs/auth/overview |
| Fine-grained authorization (current canonical) | https://mastra.ai/docs/auth/fga |
| JWT | https://mastra.ai/docs/auth/jwt |
| Workers auth | https://mastra.ai/docs/auth/workers |
| Authentication & identity guide | https://mastra.ai/docs/guides/authentication-identity |
| Supabase integration | https://mastra.ai/integrations/auth/supabase |

**iPix boundary:** Supabase Auth + server-derived organization membership remain the application identity/tenant authority. Mastra auth/FGA protects Mastra runtime resources; it does not replace Supabase RLS or iPix domain authorization.

---

## MCP & workspaces

| Topic | URL |
| --- | --- |
| MCP (current canonical) | https://mastra.ai/docs/connections/mcp |
| A2A (current canonical) | https://mastra.ai/docs/connections/a2a |
| ACP (current canonical) | https://mastra.ai/docs/connections/acp |
| SDK Agents | https://mastra.ai/docs/connections/sdk-agents |
| MCP overview (older path; may redirect) | https://mastra.ai/docs/mcp/overview |
| MCP Apps (older path; verify current docs before use) | https://mastra.ai/docs/mcp/mcp-apps |
| Workspace overview | https://mastra.ai/docs/workspace/overview |
| Workspace filesystem | https://mastra.ai/docs/workspace/filesystem |
| Workspace sandbox | https://mastra.ai/docs/workspace/sandbox |
| Workspace skills | https://mastra.ai/docs/workspace/skills |
| Workspace search & indexing | https://mastra.ai/docs/workspace/search |

Local Codex docs server:

```bash
codex mcp add mastra-docs -- npx -y @mastra/mcp-docs-server@latest
codex mcp list
```

---

## Streaming

| Topic | URL |
| --- | --- |
| Overview | https://mastra.ai/docs/streaming/overview |
| Events | https://mastra.ai/docs/streaming/events |
| Tool streaming | https://mastra.ai/docs/streaming/tool-streaming |
| Workflow streaming | https://mastra.ai/docs/streaming/workflow-streaming |
| Background task streaming | https://mastra.ai/docs/streaming/background-task-streaming |

---

## Observability & evals

| Topic | URL |
| --- | --- |
| Observability overview | https://mastra.ai/docs/observability/overview |
| Logging | https://mastra.ai/docs/observability/logging |
| Tracing overview | https://mastra.ai/docs/observability/tracing/overview |
| **Human feedback** | https://mastra.ai/docs/observability/feedback |
| Metrics | https://mastra.ai/docs/observability/metrics/overview |
| Evals overview | https://mastra.ai/docs/evals/overview |
| Built-in scorers | https://mastra.ai/docs/evals/built-in-scorers |
| **Quick checks** | https://mastra.ai/docs/evals/quick-checks |
| **Gates and verdicts** | https://mastra.ai/docs/evals/gates-and-verdicts |
| **Multi-turn evals** | https://mastra.ai/docs/evals/multi-turn |
| Custom scorers | https://mastra.ai/docs/evals/custom-scorers |
| Running evals in CI | https://mastra.ai/docs/evals/running-in-ci |
| **Vitest integration** | https://mastra.ai/docs/evals/vitest-integration |
| Evals with memory | https://mastra.ai/docs/evals/evals-with-memory |
| Datasets | https://mastra.ai/docs/evals/datasets |
| Experiments | https://mastra.ai/docs/evals/experiments |

---

## Deployment

| Topic | URL |
| --- | --- |
| Overview | https://mastra.ai/docs/deployment/overview |
| Mastra Server | https://mastra.ai/docs/deployment/mastra-server |
| Web framework (Vite, Next.js, …) | https://mastra.ai/docs/deployment/web-framework |
| **Vercel deployer (current integration)** | https://mastra.ai/integrations/deploy/vercel |
| **Cloudflare deployer** | https://mastra.ai/integrations/deploy/cloudflare |
| **Workers (background processing; beta)** | https://mastra.ai/docs/deployment/workers |
| Cloud providers | https://mastra.ai/docs/deployment/cloud-providers |
| Monorepo | https://mastra.ai/docs/deployment/monorepo |
| Workflow runners | https://mastra.ai/docs/deployment/workflow-runners |

---

## Models

| Topic | URL |
| --- | --- |
| Models overview | https://mastra.ai/models |
| Providers index | https://mastra.ai/models/providers/index |
| Environment variables | https://mastra.ai/models/environment-variables |
| OpenAI | https://mastra.ai/models/providers/openai |
| Google | https://mastra.ai/models/providers/google |
| NVIDIA | https://mastra.ai/models/providers/nvidia |
| Embeddings | https://mastra.ai/models/embeddings |

---

## Guides — app stacks

| Stack | URL |
| --- | --- |
| Quickstart | https://mastra.ai/guides/getting-started/quickstart |
| Vite + React | https://mastra.ai/guides/getting-started/vite-react |
| Next.js starter (older guide family) | https://mastra.ai/guides/getting-started/next-js |
| **Next.js integration (current)** | https://mastra.ai/integrations/frameworks/next-js |
| Express | https://mastra.ai/guides/getting-started/express |

### Current integrations useful to iPix

| Area | URL |
| --- | --- |
| PostgreSQL | https://mastra.ai/integrations/databases/postgresql |
| Firecrawl | https://mastra.ai/integrations/tools/firecrawl |
| Vercel deployer | https://mastra.ai/integrations/deploy/vercel |
| Cloudflare deployer | https://mastra.ai/integrations/deploy/cloudflare |

### Guides — build your UI

| Topic | URL |
| --- | --- |
| **CopilotKit (current integration)** | https://mastra.ai/integrations/agentic-ui/copilotkit |
| CopilotKit older guide family | https://mastra.ai/guides/build-your-ui/copilotkit |
| AI SDK UI (current integration family) | https://mastra.ai/integrations/agentic-ui/ai-sdk-ui |
| Assistant UI (current integration family) | https://mastra.ai/integrations/agentic-ui/assistant-ui |

### Guides — concepts

| Topic | URL |
| --- | --- |
| **Multi-agent systems (current)** | https://mastra.ai/docs/guides/multi-agent-systems |
| **Context engineering** | https://mastra.ai/docs/guides/context-engineering |
| **Authentication & identity** | https://mastra.ai/docs/guides/authentication-identity |
| **Streaming guide** | https://mastra.ai/docs/guides/streaming |

### Guides — agent frameworks

| Topic | URL |
| --- | --- |
| AI SDK | https://mastra.ai/guides/agent-frameworks/ai-sdk |

### Guides — deployment (hosting)

| Topic | URL |
| --- | --- |
| **Vercel deployer (current)** | https://mastra.ai/integrations/deploy/vercel |
| Vercel older guide family | https://mastra.ai/guides/deployment/vercel |

### Guides — tutorials (hands-on)

| Topic | URL |
| --- | --- |
| Web search tool | https://mastra.ai/guides/guide/web-search |
| Firecrawl tool | https://mastra.ai/guides/guide/firecrawl |
| RAG research assistant | https://mastra.ai/guides/guide/research-assistant |
| Supervisor / research coordinator | https://mastra.ai/guides/guide/research-coordinator |
| WhatsApp chat bot | https://mastra.ai/guides/guide/whatsapp-chat-bot |

---

## Examples v0 (historical — verify compatibility before use)

**Not in `mastraDocs` MCP** — fetch via browser/Firecrawl. Full map: [`references/examples-v0.md`](references/examples-v0.md)

### Agents

| Example | URL |
| --- | --- |
| Calling agents | https://mastra.ai/examples/v0/agents/calling-agents |
| Supervisor agent | https://mastra.ai/examples/v0/agents/supervisor-agent |
| AI SDK v5 integration | https://mastra.ai/examples/v0/agents/ai-sdk-v5-integration |
| WhatsApp chat bot | https://mastra.ai/examples/v0/agents/whatsapp-chat-bot |

### Workflows

| Example | URL |
| --- | --- |
| Inngest workflow | https://mastra.ai/examples/v0/workflows/inngest-workflow |

### Memory

| Example | URL |
| --- | --- |
| Working memory template | https://mastra.ai/examples/v0/memory/working-memory-template |
| Working memory schema | https://mastra.ai/examples/v0/memory/working-memory-schema |

---

## Browser automation

| Topic | URL |
| --- | --- |
| Overview | https://mastra.ai/docs/browser/overview |
| AgentBrowser | https://mastra.ai/docs/browser/agent-browser |
| BrowserViewer | https://mastra.ai/docs/browser/browser-viewer |
| Stagehand | https://mastra.ai/docs/browser/stagehand |

---

## Mastra platform (managed)

| Topic | URL |
| --- | --- |
| Overview | https://mastra.ai/docs/mastra-platform/overview |
| Server | https://mastra.ai/docs/mastra-platform/server |
| Configuration | https://mastra.ai/docs/mastra-platform/configuration |
| Observability | https://mastra.ai/docs/mastra-platform/observability |
| Studio | https://mastra.ai/docs/mastra-platform/studio |

---

## Build with AI & community

| Topic | URL |
| --- | --- |
| Skills | https://mastra.ai/docs/build-with-ai/skills |
| MCP docs server | https://mastra.ai/docs/build-with-ai/mcp-docs-server |
| Contributing templates | https://mastra.ai/docs/community/contributing-templates |

---

## Reference — workflows

**Full doc ↔ API map:** [`references/workflows.md`](references/workflows.md)

Index: https://mastra.ai/reference/workflows/

| Doc (concept) | URL | Reference API |
| --- | --- | --- |
| Agents overview | https://mastra.ai/docs/agents/overview | Agent vs workflow choice |
| Workflows overview | https://mastra.ai/docs/workflows/overview | [`Workflow`](https://mastra.ai/reference/workflows/workflow) · [`Step`](https://mastra.ai/reference/workflows/step) · [`Run`](https://mastra.ai/reference/workflows/run) |
| Workflow state | https://mastra.ai/docs/workflows/workflow-state | [Workflow state reader](https://mastra.ai/reference/workflows/workflow-state-reader) |
| Control flow | https://mastra.ai/docs/workflows/control-flow | [`.then`](https://mastra.ai/reference/workflows/workflow-methods/then) · [`.branch`](https://mastra.ai/reference/workflows/workflow-methods/branch) · [`.parallel`](https://mastra.ai/reference/workflows/workflow-methods/parallel) |
| Agents & tools | https://mastra.ai/docs/workflows/agents-and-tools | Agent steps in workflow |
| Snapshots | https://mastra.ai/docs/workflows/snapshots | State reader + storage |
| Suspend & resume | https://mastra.ai/docs/workflows/suspend-and-resume | [`.resume()`](https://mastra.ai/reference/workflows/run-methods/resume) · [`.start()`](https://mastra.ai/reference/workflows/run-methods/start) |
| Human-in-the-loop | https://mastra.ai/docs/workflows/human-in-the-loop | suspend/resume + UI |
| Time travel | https://mastra.ai/docs/workflows/time-travel | [`.timeTravel()`](https://mastra.ai/reference/workflows/run-methods/timeTravel) |
| Error handling | https://mastra.ai/docs/workflows/error-handling | [`.cancel()`](https://mastra.ai/reference/workflows/run-methods/cancel) · [`.restart()`](https://mastra.ai/reference/workflows/run-methods/restart) |
| Scheduled workflows | https://mastra.ai/docs/workflows/scheduled-workflows | [`.sleepUntil()`](https://mastra.ai/reference/workflows/workflow-methods/sleepUntil) |

---

## Reference — streaming

**Full doc ↔ API map:** [`references/streaming.md`](references/streaming.md)

Index: https://mastra.ai/reference/streaming/

| Doc (concept) | URL | Reference API |
| --- | --- | --- |
| Overview | https://mastra.ai/docs/streaming/overview | [`Agent.stream()`](https://mastra.ai/reference/streaming/agents/stream) · [`Run.stream()`](https://mastra.ai/reference/streaming/workflows/stream) |
| Events | https://mastra.ai/docs/streaming/events | [ChunkType](https://mastra.ai/reference/streaming/ChunkType) |
| Tool streaming | https://mastra.ai/docs/streaming/tool-streaming | [`createTool()`](https://mastra.ai/reference/tools/create-tool) · `context.writer` |
| Workflow streaming | https://mastra.ai/docs/streaming/workflow-streaming | [`.resumeStream()`](https://mastra.ai/reference/streaming/workflows/resumeStream) · [`.observeStream()`](https://mastra.ai/reference/streaming/workflows/observeStream) |
| Background task streaming | https://mastra.ai/docs/streaming/background-task-streaming | [`streamUntilIdle()`](https://mastra.ai/reference/streaming/agents/streamUntilIdle) · [ChunkType](https://mastra.ai/reference/streaming/ChunkType) |

---

## Reference — browser

**Full doc ↔ API map:** [`references/browser.md`](references/browser.md)

Index: https://mastra.ai/reference/browser/

| Doc (concept) | URL | Reference API |
| --- | --- | --- |
| Overview | https://mastra.ai/docs/browser/overview | [`MastraBrowser`](https://mastra.ai/reference/browser/mastra-browser) |
| AgentBrowser | https://mastra.ai/docs/browser/agent-browser | [`AgentBrowser`](https://mastra.ai/reference/browser/agent-browser) |
| BrowserViewer | https://mastra.ai/docs/browser/browser-viewer | [`BrowserViewer`](https://mastra.ai/reference/browser/browser-viewer) |
| Stagehand | https://mastra.ai/docs/browser/stagehand | [`StagehandBrowser`](https://mastra.ai/reference/browser/stagehand-browser) |
| Workflow streaming *(step writer)* | https://mastra.ai/docs/streaming/workflow-streaming | [`Run.stream()`](https://mastra.ai/reference/streaming/workflows/stream) · [`streaming.md`](references/streaming.md) |

---

## Reference — tools, auth

| Topic | URL |
| --- | --- |
| **`createTool()`** | https://mastra.ai/reference/tools/create-tool |
| **`mastra.getAgentById()`** | https://mastra.ai/reference/core/getAgentById |
| **`MastraAuthSupabase`** | https://mastra.ai/reference/auth/supabase |

---

## Reference — observability

Index: https://mastra.ai/reference/observability

| Topic | URL |
| --- | --- |
| Tracing reference | https://mastra.ai/reference/observability/tracing |
| Metrics reference | https://mastra.ai/reference/observability/metrics |

Docs: [observability overview](https://mastra.ai/docs/observability/overview) · [tracing overview](https://mastra.ai/docs/observability/tracing/overview) · [logging](https://mastra.ai/docs/observability/logging)

---

## Reference — evals

Index: https://mastra.ai/reference/evals

| Topic | URL |
| --- | --- |
| `createScorer` | https://mastra.ai/reference/evals/create-scorer |
| `runEvals` | https://mastra.ai/reference/evals/run-evals |
| `mastraScorer` | https://mastra.ai/reference/evals/mastra-scorer |
| Tool call accuracy | https://mastra.ai/reference/evals/tool-call-accuracy |
| Trajectory accuracy | https://mastra.ai/reference/evals/trajectory-accuracy |

Docs: [evals overview](https://mastra.ai/docs/evals/overview) · [built-in scorers](https://mastra.ai/docs/evals/built-in-scorers) · [running in CI](https://mastra.ai/docs/evals/running-in-ci)

---

## Reference — agents API (methods)

| Topic | URL |
| --- | --- |
| **Agents reference index** (`?list=agents`) | https://mastra.ai/reference?list=agents |
| Agent class | https://mastra.ai/reference/agents/agent |
| `mastra.getAgentById()` | https://mastra.ai/reference/core/getAgentById |
| `.generate()` | https://mastra.ai/reference/agents/generate |
| `.stream()` / output shape | https://mastra.ai/reference/streaming/agents/MastraModelOutput |
| `getLLM` | https://mastra.ai/reference/agents/getLLM |
| `getTools` | https://mastra.ai/reference/agents/getTools |
| `getDescription` | https://mastra.ai/reference/agents/getDescription |
| `getMemory` | https://mastra.ai/reference/agents/getMemory |
| `listTools` | https://mastra.ai/reference/agents/listTools |

---

## Reference — processors (built-in)

Index: https://mastra.ai/reference/processors/processor-interface

| Processor | URL |
| --- | --- |
| PII detector | https://mastra.ai/reference/processors/pii-detector |
| Prompt injection detector | https://mastra.ai/reference/processors/prompt-injection-detector |
| Moderation | https://mastra.ai/reference/processors/moderation-processor |
| Token limiter | https://mastra.ai/reference/processors/token-limiter-processor |
| Tool call filter | https://mastra.ai/reference/processors/tool-call-filter |
| Semantic recall | https://mastra.ai/reference/processors/semantic-recall-processor |
| Working memory | https://mastra.ai/reference/processors/working-memory-processor |
| Response cache | https://mastra.ai/reference/processors/response-cache |

---

## Reference — memory

**Full doc ↔ API map:** [`references/memory.md`](references/memory.md)

Index: https://mastra.ai/reference/memory/

| Doc (concept) | URL | Reference API |
| --- | --- | --- |
| Agents overview | https://mastra.ai/docs/agents/overview | Agent + memory wiring |
| Memory overview | https://mastra.ai/docs/memory/overview | [`Memory` class](https://mastra.ai/reference/memory/memory-class) |
| Storage | https://mastra.ai/docs/memory/storage | [Storage reference](https://mastra.ai/reference/storage/) |
| Message history | https://mastra.ai/docs/memory/message-history | [`deleteMessages`](https://mastra.ai/reference/memory/deleteMessages) · [message-history processor](https://mastra.ai/reference/processors/message-history-processor) |
| Working memory | https://mastra.ai/docs/memory/working-memory | [working-memory processor](https://mastra.ai/reference/processors/working-memory-processor) |
| Observational memory | https://mastra.ai/docs/memory/observational-memory | [OM reference](https://mastra.ai/reference/memory/observational-memory) · [`recall`](https://mastra.ai/reference/memory/recall) |
| Semantic recall | https://mastra.ai/docs/memory/semantic-recall | [semantic-recall processor](https://mastra.ai/reference/processors/semantic-recall-processor) |
| Memory processors | https://mastra.ai/docs/memory/memory-processors | [Processor interface](https://mastra.ai/reference/processors/processor-interface) |
| Multi-user threads | https://mastra.ai/docs/memory/multi-user-threads | [`createThread`](https://mastra.ai/reference/memory/createThread) · [`listThreads`](https://mastra.ai/reference/memory/listThreads) · [`getThreadById`](https://mastra.ai/reference/memory/getThreadById) |
| Client | — | [Client JS memory](https://mastra.ai/reference/client-js/memory) |

---

## Reference — storage, AI SDK, harness

| Topic | URL |
| --- | --- |
| Storage reference | https://mastra.ai/reference/storage/ |
| Vectors reference | https://mastra.ai/reference/vectors/ |
| AI SDK — `chatRoute()` | https://mastra.ai/reference/ai-sdk/chat-route |
| AI SDK — `toAISdkStream()` | https://mastra.ai/reference/ai-sdk/to-ai-sdk-stream |
| AI SDK — `withMastra()` | https://mastra.ai/reference/ai-sdk/with-mastra |
| Harness class | https://mastra.ai/reference/harness/harness-class |

---

## Reference — other high-traffic API areas

| Topic | URL |
| --- | --- |
| Reference home | https://mastra.ai/reference |
| Configuration | https://mastra.ai/reference/configuration |
| Client JS | https://mastra.ai/reference/client-js/client |
| Workflow methods | https://mastra.ai/reference/workflows/workflow-methods/ |

*(Full reference tree is under https://mastra.ai/reference and in `llms.txt`.)*

---

## URL patterns

| Type | Pattern |
| --- | --- |
| Doc page | `https://mastra.ai/docs/...` |
| Reference | `https://mastra.ai/reference/...` or `https://mastra.ai/reference?list=agents` |
| Guide | `https://mastra.ai/guides/...` |
| Agent markdown | add **`.md`** to a doc URL when fetching for LLM consumption |

---

## This skill (local files)

| Need | Path |
| --- | --- |
| **Intent → topic → local refs** | [`references/topic-routing.md`](references/topic-routing.md) |
| **MCP docs lookup (Cursor user-mastra)** | [`references/mcp-docs-lookup.md`](references/mcp-docs-lookup.md) |
| **Memory docs + reference API** | [`references/memory.md`](references/memory.md) |
| **Workflows docs + reference API** | [`references/workflows.md`](references/workflows.md) |
| **Streaming docs + reference API** | [`references/streaming.md`](references/streaming.md) |
| **Browser docs + reference API** | [`references/browser.md`](references/browser.md) |
| **Examples v0 + WhatsApp guide (Supatabs)** | [`references/examples-v0.md`](references/examples-v0.md) |
| Install / CLI / tsconfig | [`references/create-mastra.md`](references/create-mastra.md) |
| Remote docs workflow | [`references/remote-docs.md`](references/remote-docs.md) |
| Embedded package docs | [`references/embedded-docs.md`](references/embedded-docs.md) |
| Errors | [`references/common-errors.md`](references/common-errors.md) |
| Migration | [`references/migration-guide.md`](references/migration-guide.md) |
| Model strings helper | [`scripts/provider-registry.mjs`](scripts/provider-registry.mjs) |
| Skill rules | [`SKILL.md`](SKILL.md) |
| **Edit or improve this skill** (structure, frontmatter, triggers, evals) | [official Anthropic skill-creator](https://github.com/anthropics/claude-plugins-official/blob/main/plugins/skill-creator/skills/skill-creator/SKILL.md) |

---

## mdeai repository

| Artifact | Path |
| --- | --- |
| Runtime app | `mdeapp/` (`src/mastra/**`, `npm run dev:agent` → Studio `:4111`) |
| CopilotKit bridge | `copilotkit-integrations` skill → `references/integrations/mastra.md` |
| Mastra tasks | `tasks/mastra/` · `tasks/prompts/mastra/` |

---

*Last audited against current Mastra docs/upstream skills on **2026-09-04**; this file is curated and is **not** a byte-for-byte llms.txt mirror. Canonical full index: [mastra.ai/llms.txt](https://mastra.ai/llms.txt) (Supatabs agents/memory/workflows/streaming + ACP + multi-user threads). Re-fetch when links 404. **MCP:** `searchMastraDocs` requires `projectPath` (e.g. `/home/sk/mdeai/mdeapp`). **Upstream:** [mastra-ai/mastra issues](https://github.com/mastra-ai/mastra/issues).*
