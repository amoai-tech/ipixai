Yes. I would expand the Mastra reference pack, but keep a strict rule:

**Core Mastra = agents + tools + workflows + memory + Postgres + streaming + observability + tests.**
Tool Search, Skill Search, schedules, browser agents, deep research, autonomous workspaces, and advanced memory should stay **after Core**, consistent with your current iPix roadmap. 

As of September 2, 2026, Mastra has also added useful newer capabilities around AI SDK v7, eval gates, multi-turn evals, Tool Search, Observational Memory, Agent Browser, and Agent Harness. ([mastra.ai][1])

# 1. Mastra Core — use these first

| Priority | Use                             | Official link                                                                                                                       | How iPix should use it                                                                                                            |
| -------: | ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
|      ⭐ 1 | **Core repository**             | [https://github.com/mastra-ai/mastra](https://github.com/mastra-ai/mastra?utm_source=chatgpt.com)                                   | Source-of-truth when docs/types are unclear. Check installed source before guessing APIs.                                         |
|      ⭐ 2 | **Agents**                      | [https://mastra.ai/docs/agents/overview](https://mastra.ai/docs/agents/overview?utm_source=chatgpt.com)                             | Build `production-planner`, Brand Intelligence and later specialist agents. Start with one useful route agent, not an agent mesh. |
|      ⭐ 3 | **Tools**                       | [https://mastra.ai/docs/agents/using-tools](https://mastra.ai/docs/agents/using-tools?utm_source=chatgpt.com)                       | Implement typed `recommendShootType`, `planDeliverables`, `generateShotListDraft`, `estimateShootBudget`.                         |
|      ⭐ 4 | **Workflows**                   | [https://mastra.ai/docs/workflows/overview](https://mastra.ai/docs/workflows/overview?utm_source=chatgpt.com)                       | Use when a business process has explicit ordered stages rather than letting an agent improvise everything.                        |
|      ⭐ 5 | **Memory**                      | [https://mastra.ai/docs/memory/overview](https://mastra.ai/docs/memory/overview?utm_source=chatgpt.com)                             | Planner conversation continuity across turns, refreshes and restarts.                                                             |
|      ⭐ 6 | **PostgreSQL storage**          | [https://mastra.ai/integrations/databases/postgresql](https://mastra.ai/integrations/databases/postgresql?utm_source=chatgpt.com)   | iPix hosted Mastra persistence. Keep Mastra conversation/runtime data separate from domain truth.                                 |
|      ⭐ 7 | **Storage architecture**        | [https://mastra.ai/docs/storage](https://mastra.ai/docs/storage?utm_source=chatgpt.com)                                             | Understand what Mastra itself persists before creating custom tables.                                                             |
|      ⭐ 8 | **Context engineering**         | [https://mastra.ai/articles/context-engineering](https://mastra.ai/articles/context-engineering?utm_source=chatgpt.com)             | Keep Planner context small: approved Brand DNA + current shoot + relevant deliverables, not entire Supabase rows.                 |
|      ⭐ 9 | **Mastra development / Studio** | [https://mastra.ai/docs/develop](https://mastra.ai/docs/develop?utm_source=chatgpt.com)                                             | Inspect agents, tools and workflows in Studio before debugging them through CopilotKit.                                           |
|     ⭐ 10 | **CopilotKit integration**      | [https://mastra.ai/integrations/agentic-ui/copilotkit](https://mastra.ai/integrations/agentic-ui/copilotkit?utm_source=chatgpt.com) | Server-side Mastra view of the CopilotKit integration. Read alongside CopilotKit's Mastra docs.                                   |

### iPix Core path

```text
Agent
↓
typed tools
↓
Postgres memory
↓
CopilotKit / AG-UI
↓
authenticated streaming
↓
refresh/restart proof
↓
cross-org isolation proof
```

That aligns with the current iPix foundation backlog: persistence, replay, Planner UI and final Core certification happen before advanced Planner behavior. 

---

# 2. Workflows + HITL — important for iPix MVP

These become critical once iPix starts creating actual production plans.

| Use                        | Official link                                                                                                                                               | iPix use                                                                                                                                                        |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Workflow fundamentals**  | [https://mastra.ai/docs/workflows/overview](https://mastra.ai/docs/workflows/overview?utm_source=chatgpt.com)                                               | Deliverables → shot list → budget → approval → commit.                                                                                                          |
| **Suspend/resume concept** | [https://mastra.ai/blog/resumeworkflows](https://mastra.ai/blog/resumeworkflows?utm_source=chatgpt.com)                                                     | Stop a workflow while the operator reviews a plan and resume the same run afterward. Mastra supports resume streaming for suspended workflows. ([mastra.ai][2]) |
| **Agent approval**         | [https://mastra.ai/docs/agents/agent-approval](https://mastra.ai/docs/agents/agent-approval?utm_source=chatgpt.com)                                         | Useful when a tool/action itself requires approval.                                                                                                             |
| **CopilotKit HITL**        | [https://docs.copilotkit.ai/mastra/human-in-the-loop/useInterrupt](https://docs.copilotkit.ai/mastra/human-in-the-loop/useInterrupt?utm_source=chatgpt.com) | Render the operator approval surface in iPix.                                                                                                                   |

For iPix:

```text
Planner drafts shot plan
       ↓
Mastra workflow suspends
       ↓
CopilotKit renders approval card
       ↓
Operator edits / approves
       ↓
workflow resumes
       ↓
authenticated domain RPC commits
```

This keeps the existing iPix rule intact: **AI proposes; humans approve; domain writes happen through the authorized application path.**

---

# 3. Models — one of the biggest time savers

## Mastra model catalog

[https://mastra.ai/models](https://mastra.ai/models?utm_source=chatgpt.com)

Use this before installing provider-specific packages or hardcoding model IDs.

## Model Router

[https://mastra.ai/blog/model-router](https://mastra.ai/blog/model-router?utm_source=chatgpt.com)

Mastra's router lets an agent specify models with provider/model identifiers and supports a very large provider/model catalog, avoiding separate integration work for every provider. ([mastra.ai][3])

Example architecture:

```text
production-planner
     ↓
Mastra model router
     ├── fast/default model
     ├── stronger reasoning model
     └── fallback model
```

### For iPix

Do not build this:

```text
PlannerOpenAI
PlannerGemini
PlannerClaude
```

Build:

```text
productionPlanner
     ↓
model configuration
```

Then change the model without changing the agent architecture.

## AI SDK v7 compatibility

[https://mastra.ai/blog/ai-sdk-v7-support](https://mastra.ai/blog/ai-sdk-v7-support?utm_source=chatgpt.com)

This is worth adding to your engineering reference pack. Mastra says `@mastra/core` abstracts AI SDK provider-spec differences, including support across AI SDK generations, reducing migration work when provider packages change. ([mastra.ai][1])

### Recommended iPix model policy

| Work                        | Model                             |
| --------------------------- | --------------------------------- |
| Normal Planner conversation | fast / inexpensive                |
| Tool selection              | same model                        |
| Structured shoot plan       | reliable structured-output model  |
| Brand research              | stronger research/reasoning model |
| Asset/DNA vision            | multimodal model                  |
| Hard planning problem       | escalate to stronger model        |
| Provider outage             | configured fallback               |

**Avoid model switching unless the task benefits from it.**

---

# 4. Observability — Core, not optional

This is one area I would add to your existing list immediately.

## Mastra observability

[https://mastra.ai/ai-agent-observability](https://mastra.ai/ai-agent-observability?utm_source=chatgpt.com)

Mastra records model operations, agent execution, tool calls, memory operations and workflow steps, and supports OpenTelemetry-compatible observability. ([mastra.ai][4])

Use it for questions like:

```text
Why did Planner choose this tool?
Why was generateShotListDraft called twice?
Which model call took 8 seconds?
How many tokens did Brand Intelligence consume?
Did the approval workflow resume correctly?
```

## Production observability concepts

[https://mastra.ai/articles/ai-agent-observability](https://mastra.ai/articles/ai-agent-observability?utm_source=chatgpt.com)

Good architecture reference for:

* traces
* logs
* cost
* latency
* tool calls
* workflow steps
* eval integration

Mastra automatically creates spans around major agent operations, which makes this much cheaper than designing a custom tracing system. ([mastra.ai][5])

### iPix rule

**Use Mastra observability first.**

Do not create another custom:

```text
planner_traces
tool_execution_logs
agent_debug_events
```

unless there is a real domain/audit requirement Mastra traces do not satisfy.

---

# 5. Evals — add before Planner becomes complex

This is another high-value addition.

## Scorers

[https://mastra.ai/blog/mastra-scorers](https://mastra.ai/blog/mastra-scorers?utm_source=chatgpt.com)

Mastra scorers evaluate agent/workflow outputs asynchronously and can use deterministic or model-based evaluation. ([mastra.ai][6])

iPix examples:

```text
Does the shot list cover every approved deliverable?
Does the Planner stay within the supplied budget?
Did it invent products?
Does it cite Brand DNA evidence?
```

## Gates + verdicts

[https://mastra.ai/blog/introducing-gates-and-verdicts](https://mastra.ai/blog/introducing-gates-and-verdicts?utm_source=chatgpt.com)

**Very useful for CI.**

Mastra now supports deterministic gates alongside scorers so Vitest/Jest/Mocha can fail when agent behavior regresses. ([mastra.ai][7])

Example:

```text
Prompt:
"Build an 8-look ecommerce shoot"

Required:
✓ planDeliverables called
✓ generateShotListDraft called
✓ no database-write tool called
✓ approval requested
```

This is more reliable than checking only whether the response text “looks good.”

## Multi-turn evals

[https://mastra.ai/blog/introducing-multi-turn-evals](https://mastra.ai/blog/introducing-multi-turn-evals?utm_source=chatgpt.com)

Added very recently and highly relevant to the Planner. Mastra can now evaluate an entire multi-turn conversation using deterministic gates plus scorers. ([mastra.ai][8])

Example test:

```text
User: Plan a shoot.
Planner: asks required questions.
User: 8 looks, PDP + Instagram.
Planner: proposes deliverables.
User: change Instagram to TikTok.
Planner: updates plan without losing PDP requirements.
```

That is much closer to the real iPix workflow than a one-prompt eval.

---

# 6. Templates worth keeping

Your three are valid, but they belong to different phases.

## Agent Harness

[https://github.com/mastra-ai/template-agent-harness](https://github.com/mastra-ai/template-agent-harness?utm_source=chatgpt.com)

**Phase: Advanced reference, not iPix Core.**

It demonstrates:

* workspace
* memory
* task tracking
* web access
* command approvals
* schedules
* persistent state

Mastra describes it as a general-purpose agent harness with workspace, memory, task tracking, web access and recurring schedules. ([GitHub][9])

### Use for iPix later

Internal AI production assistant:

```text
"Research this brand,
read these files,
build a shoot research package,
and create draft tasks."
```

Do **not** use the harness to replace the structured `production-planner`.

---

## Deep Search

[https://github.com/mastra-ai/template-deep-search](https://github.com/mastra-ai/template-deep-search?utm_source=chatgpt.com)

**Phase: MVP+/Advanced.**

Especially useful for Brand Intelligence because it already demonstrates:

* iterative research
* gap detection
* nested workflows
* specialized agents
* citations
* suspend/resume

The official template explicitly combines workflows, multiple agents, self-evaluation and HITL research. ([GitHub][10])

### iPix use

```text
Brand URL
↓
research site
↓
find competitors
↓
find missing evidence
↓
research gaps
↓
create cited Brand DNA draft
↓
human approval
```

**Copy the research loop, not the whole application.**

---

## Browser Agent

[https://github.com/mastra-ai/template-browser-agent](https://github.com/mastra-ai/template-browser-agent?utm_source=chatgpt.com)

**Phase: Advanced.**

Mastra's official template uses `@mastra/agent-browser` with Playwright and a snapshot/reference model rather than brittle CSS selectors. ([GitHub][11])

Possible iPix use later:

```text
open brand site
→ inspect navigation
→ inspect collection pages
→ inspect visual merchandising
→ collect evidence
```

Do not make browser automation a Core dependency.

---

# 7. MCP — useful development accelerator

## Mastra MCP documentation server

[https://mastra.ai/blog/introducing-mastra-mcp](https://mastra.ai/blog/introducing-mastra-mcp?utm_source=chatgpt.com)

Mastra provides its docs through MCP so coding agents/IDEs can query current Mastra information rather than relying on stale training knowledge. ([mastra.ai][12])

This is especially valuable for Cursor/Claude Code when implementing iPix because Mastra APIs change quickly.

## Mastra Skills

[https://mastra.ai/blog/introducing-mastra-skills](https://mastra.ai/blog/introducing-mastra-skills?utm_source=chatgpt.com)

Mastra also publishes agent-oriented documentation as skills, and documentation pages can be consumed in Markdown form by adding `.md`. ([mastra.ai][13])

### Faster iPix development pattern

```text
1. Installed @mastra types/source
2. iPix Mastra skill
3. Mastra docs MCP
4. official docs
5. official GitHub
6. custom experimentation
```

That is significantly safer than asking a coding model to recall Mastra APIs from memory.

---

# 8. Context engineering — important before RAG

Add this:

[https://mastra.ai/articles/context-engineering](https://mastra.ai/articles/context-engineering?utm_source=chatgpt.com)

The useful principle for iPix is:

**Do not give the Planner everything. Give it exactly what it needs for the current decision.**

Mastra's current guidance emphasizes context size, memory, workflows, retrieval and model choice as connected cost/latency decisions. ([mastra.ai][14])

For example:

```text
BAD

Planner context =
all brands
+ all shoots
+ all assets
+ whole CRM
+ 150 conversation messages
```

Better:

```text
Current org
Current brand
Approved Brand DNA
Current shoot
Approved deliverables
Current user role
Relevant recent thread context
```

---

# 9. Observational Memory — Advanced

## Research

[https://mastra.ai/research/observational-memory](https://mastra.ai/research/observational-memory?utm_source=chatgpt.com)

## Announcement

[https://mastra.ai/blog/observational-memory](https://mastra.ai/blog/observational-memory?utm_source=chatgpt.com)

Mastra's Observational Memory compresses long histories into observations rather than continuously replaying raw conversation history. Their published research reports strong LongMemEval results. ([mastra.ai][15])

### iPix use later

After normal persistent Planner memory works:

```text
Week 1:
"Brand prefers natural-light product photography."

Week 8:
Planner remembers that preference
without replaying eight weeks of conversation.
```

But **do not put this on the Core critical path**.

First prove ordinary persisted threads.

---

# 10. Tool Search — definitely Advanced

This is a useful addition to your list because it is brand new.

[https://mastra.ai/blog/introducing-tool-search-processor](https://mastra.ai/blog/introducing-tool-search-processor?utm_source=chatgpt.com)

Mastra's new `ToolSearchProcessor` can expose tools on demand rather than putting every tool definition into every prompt. This can reduce context usage and improve tool selection as the tool catalog grows. ([mastra.ai][16])

### When iPix needs it

Not with:

```text
Planner:
4 tools
```

Potentially with:

```text
iPix supervisor:
60 tools

brand.*
shoot.*
asset.*
campaign.*
commerce.*
crm.*
publishing.*
analytics.*
```

Then:

```text
Agent
↓
search_tools("shoot budget")
↓
load_tool("estimateShootBudget")
↓
execute
```

So your existing decision is correct:

> **Tool Search after Core.**

---

# 11. Agent Builder — optional, later

[https://github.com/mastra-ai/template-agent-builder](https://github.com/mastra-ai/template-agent-builder?utm_source=chatgpt.com)

The official template provides a minimal code-backed Agent Builder setup, optional authentication/RBAC, workspace support and observational memory. Production use has additional licensing considerations. ([GitHub][17])

For iPix I would **not use this for the product agents yet**.

Your agents should remain code-reviewed:

```text
Git
→ PR
→ tests/evals
→ review
→ deployment
```

Later, Agent Builder could help internal AI engineers experiment safely.

---

# 12. Experiments — very useful before changing models

[https://mastra.ai/blog/mastra-experiments](https://mastra.ai/blog/mastra-experiments?utm_source=chatgpt.com)

Mastra Studio experiments can run a versioned dataset through an agent/workflow and compare scored results across prompt/model/tool changes. ([mastra.ai][18])

This gives iPix a better model-selection process:

```text
50 real shoot-planning prompts

Gemini model A → 91%
GPT model B    → 94%
Claude model C → 92%

cost
latency
tool accuracy
approval acceptance
```

Then choose based on evidence rather than benchmark marketing.

---

# Recommended final Mastra reference pack

I would put this into your project docs.

## Core

```text
Core repo
https://github.com/mastra-ai/mastra

Agents
https://mastra.ai/docs/agents/overview

Tools
https://mastra.ai/docs/agents/using-tools

Workflows
https://mastra.ai/docs/workflows/overview

Memory
https://mastra.ai/docs/memory/overview

Storage
https://mastra.ai/docs/storage

Postgres
https://mastra.ai/integrations/databases/postgresql

Develop / Studio
https://mastra.ai/docs/develop

CopilotKit integration
https://mastra.ai/integrations/agentic-ui/copilotkit

Models
https://mastra.ai/models
```

## Production quality

```text
Observability
https://mastra.ai/ai-agent-observability

Context engineering
https://mastra.ai/articles/context-engineering

Scorers
https://mastra.ai/blog/mastra-scorers

Eval gates + verdicts
https://mastra.ai/blog/introducing-gates-and-verdicts

Multi-turn evals
https://mastra.ai/blog/introducing-multi-turn-evals

Experiments
https://mastra.ai/blog/mastra-experiments

AI SDK v7 support
https://mastra.ai/blog/ai-sdk-v7-support

Model Router
https://mastra.ai/blog/model-router
```

## Advanced

```text
Agent Harness
https://github.com/mastra-ai/template-agent-harness

Deep Search
https://github.com/mastra-ai/template-deep-search

Browser Agent
https://github.com/mastra-ai/template-browser-agent

Tool Search
https://mastra.ai/blog/introducing-tool-search-processor

Observational Memory
https://mastra.ai/research/observational-memory

Mastra Skills
https://mastra.ai/blog/introducing-mastra-skills

Mastra MCP Docs
https://mastra.ai/blog/introducing-mastra-mcp

Agent Builder
https://github.com/mastra-ai/template-agent-builder
```

## Best iPix order

```text
NOW — Core
Agents
→ Tools
→ Postgres Memory
→ CopilotKit streaming
→ persistence
→ auth / org isolation
→ observability
→ Core E2E certification

NEXT — Product
Production Planner
→ structured tools
→ context engineering
→ workflows
→ HITL
→ Brand Intelligence
→ Shoot planning
→ eval gates

LATER — Advanced
Deep Search
→ Observational Memory
→ Tool Search
→ Browser Agent
→ Skills
→ schedules
→ Agent Harness
→ multi-agent orchestration
```

### Summary:

* **Most important additions now:** Tools, Workflows, Storage, Context Engineering, Observability, Evals, Model Router.
* **Best way to choose models:** Mastra model catalog + real iPix datasets/experiments, not a hardcoded provider strategy.
* **Highest-value new 2026 capability:** deterministic eval gates + multi-turn evals.
* **Keep after Core:** Tool Search, Observational Memory, Browser Agent, schedules, Agent Harness and broader multi-agent systems.
* **Faster/better approach:** copy individual patterns from official templates; **do not adopt an entire template architecture when iPix already has the runtime architecture.**

[1]: https://mastra.ai/blog/ai-sdk-v7-support?utm_source=chatgpt.com "AI SDK v7 support in Mastra | Mastra Blog"
[2]: https://mastra.ai/blog/resumeworkflows?utm_source=chatgpt.com "You can suspend/resume workflows in playground | Mastra Blog"
[3]: https://mastra.ai/blog/model-router?utm_source=chatgpt.com "Introducing Mastra Model Router: 600+ models, one API, zero package installs"
[4]: https://mastra.ai/ai-agent-observability?utm_source=chatgpt.com "AI Agent Observability: Monitor, Trace and Evaluate | Mastra"
[5]: https://mastra.ai/articles/ai-agent-observability?utm_source=chatgpt.com "AI Agent Observability: a Complete Guide for Production Teams"
[6]: https://mastra.ai/blog/mastra-scorers?utm_source=chatgpt.com "Introducing Scorers in Mastra | Mastra Blog"
[7]: https://mastra.ai/blog/introducing-gates-and-verdicts?utm_source=chatgpt.com "Introducing Gates and Verdicts for Mastra Evals"
[8]: https://mastra.ai/blog/introducing-multi-turn-evals?utm_source=chatgpt.com "Introducing Multi-turn Evals for Mastra Agents | Mastra Blog"
[9]: https://github.com/mastra-ai/template-agent-harness?utm_source=chatgpt.com "GitHub - mastra-ai/template-agent-harness: A general-purpose Mastra agent with a local workspace, shell tools, memory, task tracking, web access, and recurring schedules. · GitHub"
[10]: https://github.com/mastra-ai/template-deep-search?utm_source=chatgpt.com "GitHub - mastra-ai/template-deep-search: Template repository for template-deep-search · GitHub"
[11]: https://github.com/mastra-ai/template-browser-agent?utm_source=chatgpt.com "GitHub - mastra-ai/template-browser-agent: A browser-using agent built on @mastra/agent-browser (Playwright). Uses Mastra's Gateway for LLM calls, web search as a fallback, and persists state to Turso (libSQL). · GitHub"
[12]: https://mastra.ai/blog/introducing-mastra-mcp?utm_source=chatgpt.com "Introducing Mastra MCP Documentation Server | Mastra Blog"
[13]: https://mastra.ai/blog/introducing-mastra-skills?utm_source=chatgpt.com "Introducing Mastra Skills | Mastra Blog"
[14]: https://mastra.ai/articles/context-engineering?utm_source=chatgpt.com "Context Engineering for AI Agents: A Practical Guide"
[15]: https://mastra.ai/research/observational-memory?utm_source=chatgpt.com "Observational Memory: 95% on LongMemEval | Mastra Research"
[16]: https://mastra.ai/blog/introducing-tool-search-processor?utm_source=chatgpt.com "Introducing Tool Search for Mastra Agents | Mastra Blog"
[17]: https://github.com/mastra-ai/template-agent-builder?utm_source=chatgpt.com "GitHub - mastra-ai/template-agent-builder: Template repository for template-agent-builder · GitHub"
[18]: https://mastra.ai/blog/mastra-experiments?utm_source=chatgpt.com "Change, Run, and Compare with Experiments in Mastra Studio"
