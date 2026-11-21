# 02 — Mastra official docs and GitHub reference review

**Checked 2026-11-20.** This page examines every URL supplied for the iPix workflow roadmap. The web pages describe *current upstream Mastra*, while iPix is pinned to **@mastra/core 1.84.0 / CLI 1.40.0** on origin/main (07829181 at review). Verify installed package/types on the implementation SHA: current main website examples can be newer.

**Adoption shorthand:** Core = use or test current code; Conditional = only after proven need; Deferred = do not build now; Background = related but not workflow architecture; Unavailable = URL could not be opened through the web tool, so no specific code claim drawn from that page.

## Supplied links — evaluated individually

| Requested source | What it actually covers | iPix adoption / warning |
| --- | --- | --- |
| 1. [Reference overview with ACP filter](https://mastra.ai/reference?list=acp) | Mastra API index scoped to **ACP**, not the workflow reference itself | **Background.** Use direct workflow references below; ACP does not require a new runtime |
| 2. [Workflow State](https://mastra.ai/docs/workflows/workflow-state) | Shared workflow state via stateSchema, state, setState; distinct from per-step input/output | **Conditional.** Add only small shared counters/IDs; Brand DNA and media remain in durable domain storage |
| 3. [Control Flow](https://mastra.ai/docs/workflows/control-flow) | Sequential then, parallel, foreach, branch, map, loops and synchronization | **Core now: then.** Parallel/foreach only after measuring proven independent work; do not bypass ordered approvals |
| 4. [Agents and Tools](https://mastra.ai/docs/workflows/agents-and-tools) | Typed agent/tool steps in workflows and mapping between schemas | **Conditional.** Reuse the already-registered Planner/typed tools if it improves an existing workflow |
| 5. [Dynamic Workflows](https://mastra.ai/docs/workflows/dynamic-workflows) | JSON definitions persisted and registered at runtime; **beta** | **Deferred.** No product request currently requires editable JSON workflows; see IPI-1001 |
| 6. [Snapshots](https://mastra.ai/docs/workflows/snapshots) | Persisted execution state, completed outputs, suspended steps, retry metadata | **Core.** Prove real Postgres restart recovery. Keep snapshots small, no credentials/raw scraped pages |
| 7. [Suspend and Resume](https://mastra.ai/docs/workflows/suspend-and-resume) | Suspend typed step; persist snapshot; resume precise step with resumeData | **Core.** Already in Brand and Shoot. Verify webhook and exact persisted run on current deployment |
| 8. [Human-in-the-Loop](https://mastra.ai/docs/workflows/human-in-the-loop) | Typed suspend payload, human response, resume or bail | **Core existing.** Reuse Brand/Shoot review and durable hash; approval identity cannot come from AI or browser |
| 9. [Time Travel](https://mastra.ai/docs/workflows/time-travel) | Re-execute from an earlier step using snapshot/context; diagnostic/recovery API | **Deferred except read-only synthetic diagnostics.** Can re-run expensive or consequential steps; not an operator Retry button |
| 10. [Error Handling](https://mastra.ai/docs/workflows/error-handling) | Terminal statuses, retry policies, error lifecycle callbacks | **Core.** Retry transient read/provider issues only when replay-safe; domain writes still require idempotency |
| 11. [Dynamic Workflow Definition reference](https://mastra.ai/reference/workflows/dynamic-workflow-definition) | JSON graph entries, schemas, registered tool/agent references | **Deferred.** Validation and allowlists needed before any user-authored workflow executes |
| 12. [Workflow.agent() reference](https://mastra.ai/reference/workflows/workflow-methods/agent) | Declarative agent step; default prompt input/text output, and graph serialization | **Conditional.** Useful for stable registered agent step; cannot replace typed secure domain RPC |
| 13. [Run.start() reference](https://mastra.ai/reference/workflows/run-methods/start) | Starts workflow and waits for its result | **Core.** Appropriate for short test runs and synchronous operations; inspect result.status |
| 14. [Run.startAsync() reference](https://mastra.ai/reference/workflows/run-methods/startAsync) | Starts run and immediately returns runId for later status lookup | **Conditional.** Long requests need real persistence/recovery; runId returned is not completion proof |
| 15. [Run class URL](https://mastra.ai/reference/workflows/run) | Requested Run API class reference | **Unavailable on direct web open** (server error at review). Cross-check via Workflow Class, Run.start/startAsync, installed source/types |
| 16. [Step class reference](https://mastra.ai/reference/workflows/step) | createStep, step schemas, typed execute logic | **Core.** Existing workflows already use this; preserve bounded typed inputs |
| 17. [Workflow class reference](https://mastra.ai/reference/workflows/workflow) | createWorkflow, schema, commit, step chaining and run lifecycle | **Core.** Existing workflow registry remains the canonical owner |
| 18. [Workflow State Reader](https://mastra.ai/reference/workflows/workflow-state-reader) | Inspects public persisted run state, suspended steps and resume labels | **Conditional Core improvement.** Prefer to parsing raw snapshot; verify exact installed API and org permissions |
| 19. [Mastra upstream workflows GitHub tree](https://github.com/mastra-ai/mastra/tree/main/workflows) | Upstream source / workflow area as development reference | **Reference only.** No wholesale port into iPix or upgrade from upstream main |
| 20. [Workflow Builder Template](https://github.com/mastra-ai/workflow-builder-template) | Standalone starter for constructing workflow-builder UI and supporting pieces | **Deferred.** iPix does not need another app, editor, data model, or service |
| 21. [Introducing Dynamic Workflows blog](https://mastra.ai/blog/introducing-dynamic-workflows) | Introduces adding/updating JSON-defined workflows without a deploy (indexed as Aug 12, 2026) | **Background/Deferred.** Search index verified the article; direct open failed during review. Use official Dynamic Workflows docs for API details |

## Key interpretation for iPix

**Core (now):** typed steps and sequential flow, durable snapshots, specific suspend/resume and HITL, error status, bounded retries, current Next.js/CopilotKit review interface, server-side authority and Supabase idempotent writes.

**Advanced when useful:** stateSchema for a bounded shared value, conditional branches, parallelism/foreach for measured bottlenecks, declarative tool/agent steps, State Reader for recovery UI, a status lookup around startAsync and native observability.

**Deferred:** dynamic workflow builder, unrestricted Studio execute routes, generic time-travel retry, second workflow queue/state store, copied Mastra example app, whole new M7 platform layer.

**Safety distinction:**
- A snapshot preserves *orchestration*, not verified authorization or exactly-once side effects.
- A client-provided runId or resumeData is not authority. Validate signed callback, expected run/step, current actor/org, latest artifact revision/hash and current business state on server.
- Time travel and retries may repeat real work even if a workflow execution claim prevents concurrent callers. Never use them to replay approval/publishing/payment/paid crawls without domain idempotency.
- Dynamic JSON workflows are beta; a validation schema is not permission to invoke any registered tool.
- API examples may assume a different Mastra SDK version. Confirm the installed 1.84 types and current tests before any code changes.

## iPix code pointers (reviewed against main)

- src/mastra/runtime.ts — registers the two workflows, shared storage and server auth.
- src/mastra/workflows/brand-intelligence.ts — six steps, crawl completion suspension and human draft review.
- src/mastra/workflows/shoot-plan-review.ts — two steps, hash/revision-based review and durable verification.
- src/mastra/workflow-identity.ts — trusted workflow RequestContext identity and resource mapping.
- src/app/api/workflows/brand-intelligence/resume/route.ts — authenticated callback continuation.
- src/lib/shoot/decide-shoot-plan-revision.ts — protected resume and durable decision.
- .claude/skills/mastra/references/workflows.md — iPix native workflow design and HITL contract.
- .claude/skills/mastra/references/testing-gates.md — risk-specific test evidence.
- docs/copilotkit-mastra/workflows/01-roadmap.md — concrete ordered task owners and acceptance criteria.

**Research method:** official Mastra docs, reference API, Mastra Docs connector, Context7, official GitHub repository/template, repo main and existing Linear owners. Not all linked pages were technically reachable directly; exceptions are marked rather than inferred. No external template has been installed.
