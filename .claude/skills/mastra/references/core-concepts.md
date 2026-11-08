---
title: Mastra core concepts
description: Load when choosing agent vs workflow vs AgentController vs skill vs tool vs memory vs storage.
parent: mastra
impact: HIGH
impactDescription: Pick the right Mastra primitive before coding
tags: mastra, agents, workflows, agent-controller, skills, tools, memory, storage
source: https://github.com/mastra-ai/skills/blob/3020257c173e40f3a49ae6a67d46557fa771e0d4/skills/mastra/references/core-concepts.md
---

# Core Concepts Reference

Adapted from [official `core-concepts.md` @ 3020257c173e40f3a49ae6a67d46557fa771e0d4](https://github.com/mastra-ai/skills/blob/3020257c173e40f3a49ae6a67d46557fa771e0d4/skills/mastra/references/core-concepts.md) (skill 2.5.0), retaining iPix-specific primitive and security boundaries.

Use this when deciding which Mastra primitive to use or when explaining the high-level shape of a Mastra application.

## Discover native capabilities first

Before adding a custom service or new agent, check whether the **installed** Mastra version already supports the required agent, tool, workflow, memory, or storage primitive. Inspect embedded docs where actually packaged, then installed types/source; use current upstream docs for ideas only after verifying compatibility. Prefer one existing iPix capability over a new orchestration stack.

## Agents vs workflows vs AgentController

Agent: Autonomous, makes decisions, uses tools.
Use for open-ended tasks such as support, research, analysis, and tool-using assistants.

Workflow: Structured sequence of steps.
Use for defined processes such as pipelines, approvals, ETL, multi-step business logic, and resumable processes.

AgentController: Interactive control layer around long-running agent work with sessions, modes, approvals, subagents, persisted state, and UI events. Use only when the product needs a durable, steerable agent experience; it does not replace an ordinary workflow for a known production process.

## Key components

- Tools: Extend agent capabilities through APIs, databases, external services, and deterministic functions.
- Memory: Maintain context through message history, working memory, semantic recall, and observational memory.
- Storage: Persist data with providers such as Postgres, LibSQL, and MongoDB.

## iPixai

- **Current registry:** `src/mastra/runtime.ts` registers `default: getProductionPlannerAgent()`. `src/app/api/copilotkit/[[...slug]]/route.ts` creates tenant-scoped local agents from verified server identity. Weather-related example code still exists in `src/mastra/tools/`, but **is not the current default product agent**.
- **Tools/domain authority:** read and computation tools may return proposals. Consequential writes use exact-artifact human approval, authenticated server/domain authorization and an idempotent apply path; do not infer write access from an agent, `RequestContext`, or browser-supplied organization ID.
- **Storage:** `src/mastra/pg-store.ts` uses approved Postgres storage for hosted durable operation and fails closed when `IPIX_MASTRA_HOSTED` requires a missing/unapproved database. Local development **may use warned in-memory storage** when `MASTRA_DATABASE_URL` is absent; that state does not survive restart and is not a hosted durability proof. Check current storage guards before modifying the behavior.


## Skill

Use a skill for reusable instructions/reference material an agent should discover or load as needed. Use agent-level skills for self-contained capabilities; workspace skills for filesystem/shared discovery. Do not use skills for authorization, durable business truth, deterministic calculations, or mandatory approval gates. See `agent-skills.md` and `workspace-skills.md`.
