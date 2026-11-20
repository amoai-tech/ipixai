# Archived Mastra references — legacy MDE / Supatabs

Historical cross-project examples and documentation index. Not the iPix current runtime, tenant/security model or deployment policy. Verify vendor APIs/version before reuse.

## Shared with Supatabs (curated quick index)

**Historical MDE / Supatabs source index, not iPix architecture.** URLs are useful for general Mastra lookup, but this section's earlier rental concierge assumptions are not current iPix guidance. Use `references/README.md` and `references/topic-routing.md` to select the iPix owner; see the quarantined [legacy MDE concierge](../../../docs/archive/mastra/mdeai-concierge.md) only for explicit migration comparison. Current source and installed packages override legacy examples.

### Agents

| Area | URL |
| --- | --- |
| Overview | https://mastra.ai/docs/agents/overview |
| Using tools | https://mastra.ai/docs/agents/using-tools |
| Structured output | https://mastra.ai/docs/agents/structured-output |
| Processors | https://mastra.ai/docs/agents/processors |
| Guardrails | https://mastra.ai/docs/agents/guardrails |
| Agent approval | https://mastra.ai/docs/agents/agent-approval |
| Supervisor agents | https://mastra.ai/docs/agents/supervisor-agents |
| Background tasks | https://mastra.ai/docs/agents/background-tasks |
| Adding voice | https://mastra.ai/docs/agents/adding-voice |
| Channels | https://mastra.ai/docs/agents/channels |
| A2A | https://mastra.ai/docs/agents/a2a |
| ACP | https://mastra.ai/docs/agents/acp |
| Signals | https://mastra.ai/docs/agents/signals |
| Response caching | https://mastra.ai/docs/agents/response-caching |

### Memory

| Area | URL |
| --- | --- |
| Overview | https://mastra.ai/docs/memory/overview |
| Storage | https://mastra.ai/docs/memory/storage |
| Message history | https://mastra.ai/docs/memory/message-history |
| Observational memory | https://mastra.ai/docs/memory/observational-memory |
| Working memory | https://mastra.ai/docs/memory/working-memory |
| Semantic recall | https://mastra.ai/docs/memory/semantic-recall |
| Memory processors | https://mastra.ai/docs/memory/memory-processors |
| Multi-user threads | https://mastra.ai/docs/memory/multi-user-threads |

### Workflows

| Area | URL |
| --- | --- |
| Overview | https://mastra.ai/docs/workflows/overview |
| Workflow state | https://mastra.ai/docs/workflows/workflow-state |
| Control flow | https://mastra.ai/docs/workflows/control-flow |
| Agents & tools | https://mastra.ai/docs/workflows/agents-and-tools |
| Snapshots | https://mastra.ai/docs/workflows/snapshots |
| Suspend & resume | https://mastra.ai/docs/workflows/suspend-and-resume |
| Human-in-the-loop | https://mastra.ai/docs/workflows/human-in-the-loop |
| Time travel | https://mastra.ai/docs/workflows/time-travel |
| Error handling | https://mastra.ai/docs/workflows/error-handling |
| Scheduled workflows | https://mastra.ai/docs/workflows/scheduled-workflows |

### Streaming

| Area | URL |
| --- | --- |
| Overview | https://mastra.ai/docs/streaming/overview |
| Events | https://mastra.ai/docs/streaming/events |
| Tool streaming | https://mastra.ai/docs/streaming/tool-streaming |
| Workflow streaming | https://mastra.ai/docs/streaming/workflow-streaming |
| Background task streaming | https://mastra.ai/docs/streaming/background-task-streaming |

### Browser

| Area | URL |
| --- | --- |
| Overview | https://mastra.ai/docs/browser/overview |
| AgentBrowser | https://mastra.ai/docs/browser/agent-browser |
| BrowserViewer | https://mastra.ai/docs/browser/browser-viewer |
| Stagehand | https://mastra.ai/docs/browser/stagehand |

### Guides & examples (Supatabs)

| Area | URL |
| --- | --- |
| Guide — WhatsApp chat bot | https://mastra.ai/guides/guide/whatsapp-chat-bot |
| Example — calling agents | https://mastra.ai/examples/v0/agents/calling-agents |
| Example — supervisor agent | https://mastra.ai/examples/v0/agents/supervisor-agent |
| Example — AI SDK v5 integration | https://mastra.ai/examples/v0/agents/ai-sdk-v5-integration |
| Example — WhatsApp chat bot | https://mastra.ai/examples/v0/agents/whatsapp-chat-bot |
| Example — Inngest workflow | https://mastra.ai/examples/v0/workflows/inngest-workflow |
| Example — working memory template | https://mastra.ai/examples/v0/memory/working-memory-template |
| Example — working memory schema | https://mastra.ai/examples/v0/memory/working-memory-schema |

### Reference API (verified via MCP + HTTP 2026-05-30)

Concept docs above; **API reference** below. Use **`mastraDocs`** paths in the right column when calling MCP.

| Area | Doc / concept | Reference API |
| --- | --- | --- |
| Tools | [Using tools](https://mastra.ai/docs/agents/using-tools) · [Creating tools](https://mastra.ai/docs/tools/creating-tools) | [`createTool()`](https://mastra.ai/reference/tools/create-tool) |
| Core | [Agents overview](https://mastra.ai/docs/agents/overview) | [`mastra.getAgentById()`](https://mastra.ai/reference/core/getAgentById) |
| Workflows | [Suspend & resume](https://mastra.ai/docs/workflows/suspend-and-resume) · [Snapshots](https://mastra.ai/docs/workflows/snapshots) | [`Workflow`](https://mastra.ai/reference/workflows/workflow) · [`.resume()`](https://mastra.ai/reference/workflows/run-methods/resume) · [state reader](https://mastra.ai/reference/workflows/workflow-state-reader) · [Full index → `references/workflows.md`](../../../.agents/skills/mastra/references/workflows.md) |
| Auth | [Server auth Supabase](https://mastra.ai/docs/server/auth/supabase) | [`MastraAuthSupabase`](https://mastra.ai/reference/auth/supabase) |
| Observability | [Overview](https://mastra.ai/docs/observability/overview) · [Tracing](https://mastra.ai/docs/observability/tracing/overview) | [Reference index](https://mastra.ai/reference/observability) · [Tracing ref](https://mastra.ai/reference/observability/tracing) |
| Evals | [Overview](https://mastra.ai/docs/evals/overview) · [Built-in scorers](https://mastra.ai/docs/evals/built-in-scorers) | [Reference index](https://mastra.ai/reference/evals) · [`createScorer`](https://mastra.ai/reference/evals/create-scorer) · [`runEvals`](https://mastra.ai/reference/evals/run-evals) |
| **Memory** | [Overview](https://mastra.ai/docs/memory/overview) · [Working memory](https://mastra.ai/docs/memory/working-memory) · [Storage](https://mastra.ai/docs/memory/storage) | [`Memory` class](https://mastra.ai/reference/memory/memory-class) · [OM config](https://mastra.ai/reference/memory/observational-memory) · [Full index → `references/memory.md`](../../../.agents/skills/mastra/references/memory.md) |
| **Streaming** | [Overview](https://mastra.ai/docs/streaming/overview) · [Events](https://mastra.ai/docs/streaming/events) · [Tool streaming](https://mastra.ai/docs/streaming/tool-streaming) | [`Agent.stream()`](https://mastra.ai/reference/streaming/agents/stream) · [`MastraModelOutput`](https://mastra.ai/reference/streaming/agents/MastraModelOutput) · [Full index → `references/streaming.md`](../../../.agents/skills/mastra/references/streaming.md) |
| **Browser** | [Overview](https://mastra.ai/docs/browser/overview) · [AgentBrowser](https://mastra.ai/docs/browser/agent-browser) · [BrowserViewer](https://mastra.ai/docs/browser/browser-viewer) | [`AgentBrowser`](https://mastra.ai/reference/browser/agent-browser) · [`BrowserViewer`](https://mastra.ai/reference/browser/browser-viewer) · [Full index → `references/browser.md`](../../../.agents/skills/mastra/references/browser.md) |

**Browser doc set (Supatabs):** [overview](https://mastra.ai/docs/browser/overview) · [agent-browser](https://mastra.ai/docs/browser/agent-browser) · [browser-viewer](https://mastra.ai/docs/browser/browser-viewer) · [stagehand](https://mastra.ai/docs/browser/stagehand) · [workflow-streaming](https://mastra.ai/docs/streaming/workflow-streaming) *(step progress)*

**Streaming doc set (Supatabs):** [overview](https://mastra.ai/docs/streaming/overview) · [events](https://mastra.ai/docs/streaming/events) · [tool-streaming](https://mastra.ai/docs/streaming/tool-streaming) · [workflow-streaming](https://mastra.ai/docs/streaming/workflow-streaming) · [background-task-streaming](https://mastra.ai/docs/streaming/background-task-streaming)

**Workflow doc set (Supatabs):** [agents/overview](https://mastra.ai/docs/agents/overview) · [workflows/overview](https://mastra.ai/docs/workflows/overview) · [workflow-state](https://mastra.ai/docs/workflows/workflow-state) · [control-flow](https://mastra.ai/docs/workflows/control-flow) · [agents-and-tools](https://mastra.ai/docs/workflows/agents-and-tools) · [snapshots](https://mastra.ai/docs/workflows/snapshots) · [suspend-and-resume](https://mastra.ai/docs/workflows/suspend-and-resume) · [human-in-the-loop](https://mastra.ai/docs/workflows/human-in-the-loop) · [time-travel](https://mastra.ai/docs/workflows/time-travel) · [error-handling](https://mastra.ai/docs/workflows/error-handling) · [scheduled-workflows](https://mastra.ai/docs/workflows/scheduled-workflows)

**Memory doc set (Supatabs):** [agents/overview](https://mastra.ai/docs/agents/overview) · [memory/overview](https://mastra.ai/docs/memory/overview) · [storage](https://mastra.ai/docs/memory/storage) · [message-history](https://mastra.ai/docs/memory/message-history) · [observational-memory](https://mastra.ai/docs/memory/observational-memory) · [working-memory](https://mastra.ai/docs/memory/working-memory) · [semantic-recall](https://mastra.ai/docs/memory/semantic-recall) · [memory-processors](https://mastra.ai/docs/memory/memory-processors) · [multi-user-threads](https://mastra.ai/docs/memory/multi-user-threads)

**Examples v0 + guides (Supatabs):** [whatsapp guide](https://mastra.ai/guides/guide/whatsapp-chat-bot) · [calling-agents](https://mastra.ai/examples/v0/agents/calling-agents) · [supervisor-agent](https://mastra.ai/examples/v0/agents/supervisor-agent) · [ai-sdk-v5-integration](https://mastra.ai/examples/v0/agents/ai-sdk-v5-integration) · [whatsapp example](https://mastra.ai/examples/v0/agents/whatsapp-chat-bot) · [inngest-workflow](https://mastra.ai/examples/v0/workflows/inngest-workflow) · [working-memory-template](https://mastra.ai/examples/v0/memory/working-memory-template) · [working-memory-schema](https://mastra.ai/examples/v0/memory/working-memory-schema) · [Full index → `references/examples-v0.md`](../../../.agents/skills/mastra/references/examples-v0.md)

### mdeai stack (not in Supatabs paste — load first for this repo)

| Area | URL |
| --- | --- |
| **Getting started — project structure** | https://mastra.ai/docs/getting-started/project-structure |
| **CopilotKit + Mastra (official)** | https://mastra.ai/guides/build-your-ui/copilotkit |
| **AI SDK UI** | https://mastra.ai/guides/build-your-ui/ai-sdk-ui |
| **Web search tool (guide)** | https://mastra.ai/guides/guide/web-search |
| **Firecrawl tool (guide)** | https://mastra.ai/guides/guide/firecrawl |
| **MCP — overview** | https://mastra.ai/docs/mcp/overview |
| **MCP — MCP Apps** | https://mastra.ai/docs/mcp/mcp-apps |
| **Workspace — overview** | https://mastra.ai/docs/workspace/overview |
| **Workspace — filesystem** | https://mastra.ai/docs/workspace/filesystem |
| **Workspace — skills** | https://mastra.ai/docs/workspace/skills |
| **Workspace — search & indexing** | https://mastra.ai/docs/workspace/search |
| **Browser — overview** | https://mastra.ai/docs/browser/overview |
| **Browser — AgentBrowser** | https://mastra.ai/docs/browser/agent-browser |
| **Browser — BrowserViewer** | https://mastra.ai/docs/browser/browser-viewer |
| **Browser — Stagehand** | https://mastra.ai/docs/browser/stagehand |
| **Server — server adapters** | https://mastra.ai/docs/server/server-adapters |
| **Server — custom adapters** | https://mastra.ai/docs/server/custom-adapters |
| **Server — custom API routes** | https://mastra.ai/docs/server/custom-api-routes |
| **Server — request context** | https://mastra.ai/docs/server/request-context |
| **Server — Mastra Client** | https://mastra.ai/docs/server/mastra-client |
| **Server — auth Supabase** | https://mastra.ai/docs/server/auth/supabase |
| **Deployment — overview** | https://mastra.ai/docs/deployment/overview |
| **Deployment — Mastra Server** | https://mastra.ai/docs/deployment/mastra-server |
| **Deployment — web framework** | https://mastra.ai/docs/deployment/web-framework |
| **Mastra platform — overview** | https://mastra.ai/docs/mastra-platform/overview |
| **Mastra platform — server** | https://mastra.ai/docs/mastra-platform/server |
| **Mastra platform — configuration** | https://mastra.ai/docs/mastra-platform/configuration |
| **RAG — overview** | https://mastra.ai/docs/rag/overview |
| **RAG — chunking and embedding** | https://mastra.ai/docs/rag/chunking-and-embedding |
| **RAG — vector databases** | https://mastra.ai/docs/rag/vector-databases |
| **RAG — retrieval** | https://mastra.ai/docs/rag/retrieval |
| **RAG — GraphRAG** | https://mastra.ai/docs/rag/graph-rag |

**High-value extras** (in `llms.txt`, not in Supatabs paste):

| Area | URL |
| --- | --- |
| Workflows — suspend & resume | https://mastra.ai/docs/workflows/suspend-and-resume |
| Server — middleware | https://mastra.ai/docs/server/middleware |
| Build with AI — MCP docs server | https://mastra.ai/docs/build-with-ai/mcp-docs-server |
| Evals — overview | https://mastra.ai/docs/evals/overview |
| Evals — built-in scorers | https://mastra.ai/docs/evals/built-in-scorers |
| Evals — running in CI | https://mastra.ai/docs/evals/running-in-ci |
| Evals — datasets | https://mastra.ai/docs/evals/datasets/overview |
| Observability — tracing | https://mastra.ai/docs/observability/tracing/overview |
| Observability — SensitiveDataFilter | https://mastra.ai/docs/observability/tracing/processors/sensitive-data-filter |
| Tools — overview | https://mastra.ai/docs/tools/overview |
| Tools — creating tools | https://mastra.ai/docs/tools/creating-tools |
| Agents — networks | https://mastra.ai/docs/agents/networks |
| Voice — overview | https://mastra.ai/docs/voice/overview |
| Evals — with memory | https://mastra.ai/docs/evals/evals-with-memory |
| Agent skills | https://mastra.ai/docs/skills |
| Agent Builder — overview | https://mastra.ai/docs/agent-builder/overview |
| Server — auth overview | https://mastra.ai/docs/server/auth/index |
| Guide — CopilotKit | https://mastra.ai/guides/build-your-ui/copilotkit |
| Guide — quickstart | https://mastra.ai/guides/getting-started/quickstart |
| Workspace — sandbox | https://mastra.ai/docs/workspace/sandbox |
| Workspace — LSP | https://mastra.ai/docs/workspace/lsp |
| Editor — overview | https://mastra.ai/docs/editor/overview |
| Deployment — workflow runners | https://mastra.ai/docs/deployment/workflow-runners |
| Deployment — monorepo | https://mastra.ai/docs/deployment/monorepo |
| Guide — web search tool | https://mastra.ai/guides/guide/web-search |
| Guide — WhatsApp chat bot | https://mastra.ai/guides/guide/whatsapp-chat-bot |
| Guide — AI recruiter workflow | https://mastra.ai/guides/guide/ai-recruiter |
| Guide — research assistant (RAG) | https://mastra.ai/guides/guide/research-assistant |
| Guide — supervisor research coordinator | https://mastra.ai/guides/guide/research-coordinator |
| Migration — network to supervisor | https://mastra.ai/guides/migrations/network-to-supervisor |
| Migration — upgrade to v1 (overview) | https://mastra.ai/guides/migrations/upgrade-to-v1/overview |

---

