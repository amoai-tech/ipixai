---
title: Mastra skill — reference index
description: Load to pick the smallest Mastra reference set for the task. Use progressive disclosure; do not read the whole skill tree by default.
parent: mastra
impact: HIGH
impactDescription: Prevents stale reference routing and unnecessary context loading
tags: mastra, index, references
---

# Mastra references index

Read the **smallest relevant reference set**. One reference is often enough; load more only when the task crosses domains (for example workflow + auth + streaming).

## Core iPix references

| File | Load when |
| --- | --- |
| [`topic-routing.md`](topic-routing.md) | Unsure which Mastra reference/docs path applies |
| [`embedded-docs.md`](embedded-docs.md) | Need exact installed API/source lookup |
| [`mcp-docs-lookup.md`](mcp-docs-lookup.md) | Using Mastra docs MCP/current remote docs |
| [`core-concepts.md`](core-concepts.md) | Agent vs tool vs workflow vs memory/storage decision |
| [`tools.md`](tools.md) | `createTool`, schemas, authority, natural-language selection |
| [`workflows.md`](workflows.md) | Workflows, snapshots, HITL, suspend/resume, callbacks, idempotency |
| [`memory.md`](memory.md) | Message history, working memory, resource/thread scope, persistence |
| [`streaming.md`](streaming.md) | AG-UI/SSE, Stop, AbortSignal propagation |
| [`supabase-auth.md`](supabase-auth.md) | Current iPix auth/tenant/RequestContext boundary or future standalone Mastra auth |
| [`evals-feedback.md`](evals-feedback.md) | Datasets, experiments, scorers, multi-turn regression, feedback |
| [`common-errors.md`](common-errors.md) | Real iPix Mastra failure patterns / debugging |
| [`migration-guide.md`](migration-guide.md) | Mastra package-family/version upgrades |
| [`mastra-api.md`](mastra-api.md) | Local Studio/API inspection; use local installed CLI only |
| [`trace-intelligence.md`](trace-intelligence.md) | Aggregate production trace themes; advanced/conditional |

## Optional / advanced — not current critical path unless a task explicitly activates them

| File | Capability |
| --- | --- |
| [`agents-supervisor.md`](agents-supervisor.md) | supervisors/subagents |
| [`agent-controller.md`](agent-controller.md) | Harness / long-lived steerable agent product patterns |
| [`advanced-runtime.md`](advanced-runtime.md) | dynamic workflows, channels, pub/sub, code mode |
| [`browser.md`](browser.md) | Agent Browser / Stagehand |
| [`agent-skills.md`](agent-skills.md) | first-class Mastra agent skills |
| [`skill-search.md`](skill-search.md) | lazy skill discovery |
| [`tool-search.md`](tool-search.md) | lazy large-tool-catalog discovery |
| [`workspace.md`](workspace.md) / [`workspace-skills.md`](workspace-skills.md) | Mastra workspace/filesystem skills |
| [`mcp.md`](mcp.md) / [`mcp-apps.md`](mcp-apps.md) | MCP client/server/apps |
| [`rag-mastra.md`](rag-mastra.md) / [`rag-pgvector.md`](rag-pgvector.md) | RAG/vector work |

Do not pull these capabilities into Core merely because upstream Mastra supports them.

## CopilotKit boundary

Current iPix uses CopilotKit/AG-UI in-process around local Mastra agents. For CopilotKit v2 UI/protocol behavior, use the `copilotkit` skill. The Mastra `copilotkit.md`, display/headless/slots references are external/example material and must not override current iPix wiring.

## Current runtime reminder

As of the current PR branch, the product agent is the **Production Planner** behind the load-bearing `default` registry path; the old weather-agent text is historical/stale. Always re-check current code on the task SHA rather than treating this index as runtime truth.

Current installed family must also be re-read from `package.json`/lockfile; do not copy version numbers from an old reference file or install `latest` by default.

## Source priority

```text
current iPix code + live Linear owner
→ installed package versions/source/types
→ embedded docs where available
→ Mastra docs MCP/current official docs
→ official release/migration notes/issues for version-specific questions
```

## Global safety reminders

- browser IDs/context are claims until server verified;
- memory/RequestContext are not authorization;
- RequestContext may appear in traces/datasets—keep it minimal and non-secret;
- workflow snapshots are durable state—store references, not giant duplicated payloads;
- consequential approval binds to exact artifact/revision/hash;
- Stop UI success is not proof downstream work stopped;
- one green proof class cannot substitute for another;
- latest upstream capability is not automatically an iPix requirement.
