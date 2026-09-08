---
name: mastra
description: "Mastra framework for iPixai: docs lookup, agents, workflows, tools, memory, streaming, PostgresStore, Studio/API, MCP, observability, evals, and Lumina→iPix adaptation. Use whenever editing src/mastra/**, pinning @mastra/* versions, changing agents/tools/workflows/memory/storage/HITL/abort behavior, or verifying Mastra APIs. Always verify installed source/types first; use the official Mastra MCP/docs for current concepts and migrations. In this repo use npm run dev:agent and npm run dev:ui separately — never combined npm run dev."
license: Apache-2.0
metadata:
  author: Mastra
  version: "2.2.2-ipix.2"
  basedOn: mastra-ai/skills 2.1.0 + iPix/Lumina audit 2026-09-08
  repository: https://github.com/mastra-ai/skills
  title: Mastra framework guide
  impact: HIGH
  impactDescription: Agent/workflow/memory correctness, tenant safety, HITL, runtime reliability
  tags: mastra, agents, workflows, tools, memory, hitl, streaming, mcp, evals
  paths:
    - "src/mastra/**"
    - "docs/mastra/**"
    - "**/*mastra*"
---

# Mastra Framework Guide

## Core rule — verify exact installed behavior

Mastra evolves rapidly. APIs, constructor signatures, workflow semantics, memory behavior, processor contracts, and package-family compatibility change frequently.

For exact-version implementation questions use:

```text
installed TypeScript types/source
→ embedded docs when that installed package actually ships them
→ this iPix Mastra skill
→ official Mastra MCP / current docs
→ official GitHub source/tag/issues when still ambiguous
```

Do not assume every installed `@mastra/*` package ships embedded docs. `listMastraPackages` / installed filesystem inspection decides that. Do not let latest web examples override pinned installed APIs.

For dependency changes:

```text
record full installed Mastra/CopilotKit/AG-UI family
→ identify proven incompatibility
→ inspect migration/release guidance
→ choose one compatible target family
→ upgrade only required packages together
→ targeted type/runtime/memory/workflow/streaming regressions
```

Never use `npm update @mastra/core` as a generic troubleshooting step.

---

## Current iPixai wiring — as built, not migration target

**Location:** `src/mastra/` in current iPixai. Old Lumina/iPix `app/src/mastra/` is reference material only.

Current verified architecture must be re-checked on the task SHA before implementation, but the present V2 shape is:

```text
CopilotKit / AG-UI
→ server-derived org + user identity
→ Mastra local agents
→ default registry entry resolves to productionPlannerAgent
→ typed compute/read tools
→ Mastra Memory
→ shared PostgresStore
→ Supabase `mastra` schema
```

Rules:

- **CopilotKit:** `MastraAgent.getLocalAgents({ mastra, resourceId })`; `resourceId` is server-derived from trusted org + user identity. Never hardcode `"default"` as the tenant/resource boundary.
- **Agent registry:** current V2 already uses Production Planner behind the load-bearing `default` registry key. Do not reintroduce the weather demo or duplicate aliases without a current caller requirement.
- **Storage:** hosted/runtime paths that require durable Mastra state must fail closed when approved Postgres configuration is unavailable. Do not silently fall back to in-memory/LibSQL and claim hosted durability.
- **Postgres:** reuse the existing process-scoped/shared store/pool configuration; do not create a new pool/store per request unless installed runtime constraints prove that is required.
- **Model/provider:** use the current V2 provider/model owner. Do not port Lumina Cloudflare `resolveAgentModel` or provider routing because it existed historically.
- **Tools:** current Planner tools use typed input/output schemas. Consequential domain writes belong behind explicit server/domain authorization and approval boundaries, not prompt language alone.
- **Dev:** `npm run dev:agent` (`:4111`) and `npm run dev:ui` (`:3000`) separately — never combined `npm run dev`.
- **MCP `projectPath`:** pass only to tools whose schema requires it and use this repo root. Do not pass `projectPath` to `mastraDocs`.

`docs/mastra/10-mastra-convert.md` is historical migration research, not current architecture SSOT. Current code + live Linear architecture/tasks + installed package behavior win.

---

## Lumina → iPix Mastra adaptation rule

Lumina is valuable for **business invariants, deterministic logic, schemas, fixtures, and failure lessons**. It is not runtime authority.

Never classify an entire mixed Lumina Mastra file as one `PORT`/`DROP` unit. Follow `../tasks/references/migration-lumina.md` and classify each symbol/behavior independently.

Typical decisions:

```text
Planner business sequencing          → EXTRACT + REUSE
least-privilege tool selection        → REIMPLEMENT on current registry
pure compute logic + tests            → PORT / ADAPT after current-data verification
browser page context trust model      → REIMPLEMENT using current RequestContext + server verification
workflow stage ordering               → REUSE invariant
suspend/resume transport              → REIMPLEMENT on installed current Mastra/AG-UI/CopilotKit
Cloudflare model router               → DROP
DurableAgent/old Worker glue           → DROP unless a current reproduced failure requires it
JWT/service key in tool/workflow data  → DROP
legacy direct DB write tools           → REIMPLEMENT at current domain/server boundary
```

### Known Lumina traps that must become tests, not copied behavior

- `approved: false` must not fall through the same branch as "not resumed yet" and suspend again.
- Human approval must bind to the exact validated artifact/revision/hash shown to the operator.
- Resume must not silently recompute a materially different proposal after approval.
- Browser-provided `brand_id`, `shoot_id`, `org_id`, or page context are claims until server-verified.
- Credentials must never be persisted in workflow input, suspend data, working memory, traces, or model-visible context.
- External callback/webhook resume must validate expected run + external job/crawl ID and reject replay/mismatch.
- Provider/model failure must fail closed; stale prior output must never become a fresh successful draft.
- A successful-looking UI state is not proof a workflow/tool completed correctly.

---

## Mastra risk classes

At task start classify which Mastra concerns are affected:

`agent registry/identity` · `model/provider` · `tool schema` · `tool authority` · `external side effect` · `RequestContext/tenant context` · `memory resource/thread scope` · `persistent storage` · `streaming/Stop/abort` · `workflow` · `suspend/resume` · `HITL approval` · `MCP` · `observability/evals` · `Mastra package-family change`.

Any change involving tenant identity, memory ownership, consequential tools, approval, resume, callback/webhook continuation, persistent storage, cancellation, MCP auth, or package-family changes requires Adversarial `task-verifier` coverage.

---

## Independent proof classes for Mastra work

Do not let one green test stand in for a different property. Determine which proof classes apply:

| Proof class | What it proves |
| -- | -- |
| Registry/config | intended agent/model/tool/workflow is actually registered and selected |
| Deterministic primitive | tool/step/schema logic is correct without model nondeterminism |
| Model behavior | natural language chooses the right tool/workflow and valid arguments |
| Authority/context | server-derived caller/org/context can perform the action; foreign/untrusted claims fail |
| Memory | correct thread/resource scope; no cross-thread/org bleed |
| Persistence/restart | required state survives a real new process/instance using durable storage |
| HITL artifact | human reviewed and approved the exact immutable revision/hash that continues |
| Resume/recovery | stale/duplicate/foreign/malformed resume cannot advance or duplicate effects |
| Streaming/abort | Stop/AbortSignal reaches downstream model/tool/provider work, not just the visible SSE |
| Side-effect idempotency | retry/double-resume/lost-response produces at most one business effect |
| Observability/evals | failures/quality regressions can be diagnosed without leaking protected data |
| Exact runtime | exact deployed/tested SHA performs the real operator journey |

Examples of invalid substitutions:

```text
tool.execute() passes        ≠ model selects the tool correctly
model selects the tool       ≠ caller is authorized
row/message persisted        ≠ new process actually uses it
Stop button responds         ≠ downstream work cancelled
resume returns success       ≠ resume is idempotent
approved=true                ≠ exact artifact was approved
trace says success           ≠ operator/business outcome succeeded
```

---

## Tools

For tools, prefer current Mastra `createTool` patterns with both `inputSchema` and `outputSchema` where the installed version supports them.

Every material tool should be reviewed across four independent dimensions:

```text
schema correctness
+ business correctness
+ authority/context correctness
+ agent-selection correctness
```

For tools that call external services or perform expensive work, propagate/use the execution `abortSignal` when supported. Test that Stop cancels downstream work where the user-visible contract requires cancellation.

Natural-language behavior tests should include:

```text
should call
should not call
correct tool vs plausible wrong tool
missing required input
ambiguous intent
invalid/malicious arguments
```

A forced `toolChoice` test may supplement deterministic coverage but cannot be the only proof of agent routing.

---

## Memory

Keep these concepts separate:

```text
message history  = conversation turns for a thread
working memory   = structured agent state at configured scope
resource         = ownership/partition key that may own multiple threads
authorization    = server/domain truth, never memory itself
```

Do not use resource/thread IDs, vector retrieval, possession of a run ID, or recalled memory as authorization.

For persistence work prove separately:

1. message history survives a real process restart;
2. working memory survives/reloads at its configured scope if required;
3. wrong resource/org cannot read or continue the thread;
4. a new thread does not inherit thread-only facts accidentally.

Do not enable semantic recall or Observational Memory merely because they are available; require a dedicated product/use-case task plus cost, concurrency, restart, privacy, and runtime proof.

---

## Workflows and HITL

For consequential workflows, the default iPix pattern is:

```text
AI proposes
→ validated artifact/revision created
→ Mastra suspends / human review surface appears
→ server verifies approver + org + artifact ownership
→ human explicitly approves/rejects exact revision
→ resume validates immutable revision/hash
→ domain state revalidated
→ idempotent server/domain commit
→ result/audit recorded
```

Prompt text such as "wait for approval" is behavior guidance, not enforcement.

Review-state schemas should be discriminated and explicit, e.g. `approved | rejected | revision_requested | cancelled | expired`; avoid truthy/falsy approval shortcuts.

Mandatory adversarial cases when applicable:

```text
resume once
resume twice
resume concurrently
resume wrong run
resume wrong step
resume wrong tenant
resume malformed payload
stale artifact/revision
approve vs reject race
refresh/reconnect while suspended
provider failure after approval
write succeeds but response is lost
process restart before resume
process restart after commit
```

Every consequential side effect needs domain-level uniqueness/idempotency. UI disabled states or a single resume call are not enough.

---

## Streaming / Stop

Where Stop/cancellation is a product requirement, prove the whole chain:

```text
operator presses Stop
→ request AbortSignal / runtime cancellation
→ agent run aborts
→ tool/provider receives cancellation where supported
→ no later protected side effect
→ stream closes cleanly
```

Do not claim Stop is correct because the UI closes the stream.

---

## Observability and evals

For production AI journeys, traces/evals should answer only what is needed to diagnose and improve the system:

```text
org/user/thread correlation
agent/model/tool/workflow selected
latency / provider error / tool result status
token or cost signals where available
approval/revision status
```

Redact or avoid sensitive brand/customer content and credentials. Do not indiscriminately export full prompts/tool payloads.

Build eval datasets from real iPix failures: wrong tool selection, missing input invention, stale reference provenance, approval bypass, duplicate side effect, tenant-context misuse, and unsupported claims.

---

## Quick topic routing

| Question | Where to look |
|----------|---------------|
| "Where is the doc for X?" | [`links.md`](links.md) → [`references/topic-routing.md`](references/topic-routing.md) |
| Agent vs workflow vs memory | [`references/core-concepts.md`](references/core-concepts.md) |
| Agent / Workflow / Tool API | [`references/embedded-docs.md`](references/embedded-docs.md) |
| Memory | [`references/memory.md`](references/memory.md) |
| Agent-level skills | [`references/agent-skills.md`](references/agent-skills.md) |
| Tool search | [`references/tool-search.md`](references/tool-search.md) |
| Advanced runtime | [`references/advanced-runtime.md`](references/advanced-runtime.md) |
| Evals / feedback | [`references/evals-feedback.md`](references/evals-feedback.md) |
| Auth / identity | [`links.md#auth--identity`](links.md#auth--identity) + [`references/supabase-auth.md`](references/supabase-auth.md) |
| Observability / traces | [`links.md#observability--evals`](links.md#observability--evals) |
| Workflows / HITL | [`references/workflows.md`](references/workflows.md) |
| Streaming / AG-UI bridge | [`references/streaming.md`](references/streaming.md) |
| Model selection | [`references/model-selection.md`](references/model-selection.md) then `scripts/provider-registry.mjs` |
| Studio/API | [`references/mastra-api.md`](references/mastra-api.md) |
| MCP client/server | [`references/mcp.md`](references/mcp.md) + [`links.md`](links.md) |
| CopilotKit + Mastra | current in-process wiring + `copilotkit` skill |
| Common errors | [`references/common-errors.md`](references/common-errors.md) |
| Migration | `../tasks/references/migration-lumina.md` + [`references/migration-guide.md`](references/migration-guide.md) |
| Full reference index | [`references/README.md`](references/README.md) |

---

## Mastra docs MCP

Use the configured official Mastra documentation MCP as targeted current research, not as an excuse to ignore installed APIs.

| Tool | Use when |
|------|----------|
| `mastraDocs` | current conceptual/API docs by known path/keywords; no `projectPath` |
| `listMastraPackages` | discover which installed packages expose embedded docs |
| `readMastraDocs` | read embedded docs from installed packages when available |
| `searchMastraDocs` | keyword search across installed embedded docs |
| `getMastraExports` / `getMastraExportDetails` | inspect package exports/types where exposed |
| `mastraMigration` | current migration/upgrade guidance |

If embedded docs are absent for an installed package, inspect installed TypeScript source/types first, then use remote MCP/docs.

---

## Mastra Studio and CLI

Official docs use `mastra dev`; in iPixai run the repository-owned scripts:

```bash
npm run dev:agent
npm run dev:ui
```

Use the pinned local CLI only:

```bash
npx --no-install mastra --version
npx --no-install mastra api --help
```

Never use a bare `npx mastra` that can fetch a newer package unexpectedly. Do not overwrite this iPix overlay with upstream skills wholesale.
