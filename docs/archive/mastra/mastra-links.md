Mastra Core — use these first
Priority	Use	Official link	How iPix should use it
⭐ 1	Core repository	https://github.com/mastra-ai/mastra	Source-of-truth when docs/types are unclear. Check installed source before guessing APIs.
⭐ 2	Agents	https://mastra.ai/docs/agents/overview	Build production-planner, Brand Intelligence and later specialist agents. Start with one useful route agent, not an agent mesh.
⭐ 3	Tools	https://mastra.ai/docs/agents/using-tools	Implement typed recommendShootType, planDeliverables, generateShotListDraft, estimateShootBudget.
⭐ 4	Workflows	https://mastra.ai/docs/workflows/overview	Use when a business process has explicit ordered stages rather than letting an agent improvise everything.
⭐ 5	Memory	https://mastra.ai/docs/memory/overview	Planner conversation continuity across turns, refreshes and restarts.
⭐ 6	PostgreSQL storage	https://mastra.ai/integrations/databases/postgresql	iPix hosted Mastra persistence. Keep Mastra conversation/runtime data separate from domain truth.
⭐ 7	Storage architecture	https://mastra.ai/docs/storage	Understand what Mastra itself persists before creating custom tables.
⭐ 8	Context engineering	https://mastra.ai/articles/context-engineering	Keep Planner context small: approved Brand DNA + current shoot + relevant deliverables, not entire Supabase rows.
⭐ 9	Mastra development / Studio	https://mastra.ai/docs/develop	Inspect agents, tools and workflows in Studio before debugging them through CopilotKit.
⭐ 10	CopilotKit integration	https://mastra.ai/integrations/agentic-ui/copilotkit	Server-side Mastra view of the CopilotKit integration. Read alongside CopilotKit's Mastra docs.


Below is the cleaned **Mastra official GitHub reuse matrix for iPix**. These are reference implementations, not architectures to copy wholesale. The main Mastra repository is active and uses `main` as its default branch; your existing iPix research pack also places these templates after checking installed Mastra capabilities first. 

| Reference                                                                                                                                                 | What it provides                                                                                          | Exact iPix use                                                                                                                                            | What to reuse                                                                         | Custom code avoided                                                            | Limits / cost                                                                                                                  |
| --------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| **Mastra Core Repository** — [https://github.com/mastra-ai/mastra](https://github.com/mastra-ai/mastra)                                                   | Framework source, packages, TypeScript types, tests, examples, integrations, templates                    | **All Mastra tasks.** Use when docs are unclear or to verify actual behavior against the installed Mastra version                                         | Agent, tool, workflow, memory, storage, MCP and server implementation patterns; tests | Guessing APIs; duplicating framework primitives; unnecessary wrappers          | Large monorepo. `main` may be newer than iPix's installed version, so compare against lockfile/types before copying            |
| **Mastra Templates Index** — [https://github.com/mastra-ai/mastra/tree/main/templates](https://github.com/mastra-ai/mastra/tree/main/templates)           | Official collection of starter/template implementations                                                   | **Before any new agent/workflow capability.** Search here to see whether Mastra already demonstrates the required pattern                                 | Smallest matching template, configuration, file layout, testing pattern               | Greenfield scaffolding; inventing project structure; boilerplate               | Templates may demonstrate more infrastructure than iPix needs. Copy patterns, not whole apps                                   |
| **Mastra Workshops** — [https://github.com/mastra-ai/workshops](https://github.com/mastra-ai/workshops)                                                   | Guided tutorials, recipes and implementation exercises                                                    | Developer reference for unfamiliar Mastra features before custom experimentation                                                                          | Working code sequences for agents, tools, workflows and integrations                  | Trial-and-error implementation; internal tutorial creation                     | Educational examples may optimize for learning rather than production architecture                                             |
| **Mastra UI Dojo** — [https://github.com/mastra-ai/ui-dojo](https://github.com/mastra-ai/ui-dojo)                                                         | Agent UI integration examples including CopilotKit, generative UI and HITL patterns                       | **CopilotKit + Mastra UI work:** Planner cards, approval UI, workflow rendering, streaming experiments                                                    | GenUI, tool rendering, workflow/HITL integration patterns                             | Custom bridge between Mastra events and AI UI; bespoke demo interfaces         | Reference UI, not iPix design system. Reuse interaction architecture, not styling/layout                                       |
| **Deep Search Template** — [https://github.com/mastra-ai/template-deep-search](https://github.com/mastra-ai/template-deep-search)                         | Iterative research, search, gap detection, multi-step research, citations and evaluation                  | **IPI-1093 · BRAND-INTEL-001 — Turn a Brand Website Into an Approved Brand DNA Profile.** Research brand, competitors and missing evidence                | Search → evaluate → find gaps → research again → synthesize with citations            | Custom deep-research orchestrator; manual search-loop state; citation workflow | External search/model costs. More complex than simple URL extraction; use only when deeper research is required                |
| **Company Knowledge Template** — [https://github.com/mastra-ai/template-company-knowledge](https://github.com/mastra-ai/template-company-knowledge)       | Knowledge ingestion, embeddings, retrieval and pgvector-oriented RAG patterns                             | **IPI-1128 · BRAND-KNOWLEDGE-001 — Give AI Decisions Approved Brand Evidence With Citations.** Retrieve approved Brand DNA/evidence for Planner decisions | Chunking, embedding, retrieval, grounding and knowledge-query patterns                | Custom RAG skeleton; custom retrieval pipeline                                 | Must adapt to iPix Supabase RLS/org ownership. Do not duplicate canonical Brand data into a second source of truth             |
| **Browser Agent Template** — [https://github.com/mastra-ai/template-browser-agent](https://github.com/mastra-ai/template-browser-agent)                   | Browser automation agent using Mastra browser tooling / Playwright-style interaction                      | Advanced Brand Intelligence when a site requires JS interaction, navigation or UI actions that Firecrawl/API extraction cannot perform                    | Browser session, page interaction, agent-browser tool patterns                        | Custom Playwright-agent wrapper; browser action DSL                            | Browser automation is slower, more fragile and more expensive than HTTP/API extraction. Use as fallback, not default           |
| **Agent Harness Template** — [https://github.com/mastra-ai/template-agent-harness](https://github.com/mastra-ai/template-agent-harness)                   | Long-running agent workspace with memory, tasks, approvals, web access and scheduling                     | **Advanced internal iPix production/research assistant**, e.g. “research this brand, inspect documents and prepare a production research package”         | Workspace, task tracking, approval, persistent state, schedule patterns               | Building an autonomous-agent control plane from scratch                        | Too much machinery for Core Planner. Some harness features are advanced/beta; larger operational/security surface              |
| **GitHub Review Agent Template** — [https://github.com/mastra-ai/template-github-review-agent](https://github.com/mastra-ai/template-github-review-agent) | Agent-driven GitHub/code-review workflow pattern                                                          | Internal iPix engineering automation: summarize PRs, inspect changes, suggest review findings                                                             | GitHub tool orchestration, review-agent prompt/tool patterns                          | Custom AI code-review workflow and GitHub plumbing                             | **Not product-runtime functionality.** GitHub/API/model usage can incur limits/costs; human review should remain authoritative |
| **Docs Chatbot Template** — [https://github.com/mastra-ai/template-docs-chatbot](https://github.com/mastra-ai/template-docs-chatbot)                      | Documentation ingestion/retrieval and conversational querying pattern, useful for MCP/reference knowledge | Internal iPix engineering assistant for querying project docs, Mastra/CopilotKit guidance, or future operator knowledge surfaces                          | Document retrieval, grounded answering and connection patterns                        | Custom documentation chatbot/RAG implementation                                | Keep out of Core product path unless there is a real user requirement. Retrieval quality depends on source quality/indexing    |

## Best use order for iPix

| Priority | Reference                                                                                                              | Use when                                                     |
| -------: | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
|    **1** | [https://github.com/mastra-ai/mastra](https://github.com/mastra-ai/mastra)                                             | Always verify framework/source behavior first                |
|    **2** | [https://github.com/mastra-ai/mastra/tree/main/templates](https://github.com/mastra-ai/mastra/tree/main/templates)     | Check whether an official starter already solves the problem |
|    **3** | [https://github.com/mastra-ai/ui-dojo](https://github.com/mastra-ai/ui-dojo)                                           | CopilotKit/GenUI/HITL UI work                                |
|    **4** | [https://github.com/mastra-ai/template-deep-search](https://github.com/mastra-ai/template-deep-search)                 | Brand Intelligence research                                  |
|    **5** | [https://github.com/mastra-ai/template-company-knowledge](https://github.com/mastra-ai/template-company-knowledge)     | Approved Brand evidence/RAG                                  |
|    **6** | [https://github.com/mastra-ai/workshops](https://github.com/mastra-ai/workshops)                                       | Learn/validate unfamiliar Mastra capabilities                |
|    **7** | [https://github.com/mastra-ai/template-browser-agent](https://github.com/mastra-ai/template-browser-agent)             | Browser automation only when extraction/API is insufficient  |
|    **8** | [https://github.com/mastra-ai/template-agent-harness](https://github.com/mastra-ai/template-agent-harness)             | Advanced long-running internal agent                         |
|    **9** | [https://github.com/mastra-ai/template-github-review-agent](https://github.com/mastra-ai/template-github-review-agent) | Engineering automation, not product core                     |
|   **10** | [https://github.com/mastra-ai/template-docs-chatbot](https://github.com/mastra-ai/template-docs-chatbot)               | Documentation assistant/RAG when specifically needed         |

### iPix rule

```text
Existing iPix code
→ installed Mastra source/types
→ built-in Mastra primitive
→ Studio / CLI
→ official integration/module
→ official template
→ official workshop/example
→ smallest custom code
```

For example:

```text
Need Brand research?
→ Firecrawl/simple extraction first
→ Deep Search template if iterative research is needed
→ Browser Agent only if interaction is required
→ custom browser/research framework = last option
```

**Best decision:** the highest-value repositories for the actual iPix product are **Mastra core → templates → UI Dojo → Deep Search → Company Knowledge**. Browser Agent and Agent Harness should remain **Advanced**, not Core.

