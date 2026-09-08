---
title: Mastra workflows — iPix suspend/resume contract
description: Load when building or verifying Mastra workflows, suspend/resume, durable snapshots, callbacks, or human approval.
parent: mastra
impact: HIGH
impactDescription: Prevents stale approval, replay, duplicate effects, and custom workflow infrastructure
tags: mastra, workflows, suspend, resume, hitl, snapshots, idempotency
---

# Mastra workflows — iPix contract

## When to use a workflow

Use a Mastra workflow when the execution order is known and explicit. Use agents for open-ended reasoning and tools/code for deterministic operations.

Do not create a generic workflow framework before current iPix workflows prove repeated conventions worth extracting. `IPI-994 · MASTRA-WF-001 — Establish Reusable iPix Workflow Foundation` remains deferred until that gate is met.

## Native primitives first

Prefer current installed Mastra primitives directly:
- `createWorkflow` / `createStep`;
- `.then()`, `.branch()`, `.parallel()` and other native control flow;
- step `suspend()`;
- typed `suspendSchema` / `resumeSchema`;
- persisted workflow snapshots through configured storage;
- run `.resume()` / recovery APIs supported by the installed version.

Do not build a custom workflow runner, browser-owned workflow truth, generic status database, Temporal/DurableAgent layer, or second approval framework unless a current proven gap requires it.

## iPix HITL state model

Never represent mandatory review as a boolean truthiness shortcut.

Use an explicit discriminated state, for example:

```text
awaiting_review
approved
rejected
revision_requested
cancelled
expired
```

`approved: false` must not be indistinguishable from "not resumed yet".

## Approval must bind to the exact artifact

For consequential continuation, record and validate the reviewed proposal identity:

```text
artifact_id
revision
canonical_hash
exact validated snapshot
actor
org/resource ownership
workflow run
suspended step / resume target
approval timestamp
```

Invariant:

```text
artifact rendered for review
=
artifact explicitly approved
=
artifact allowed to continue to the domain commit
```

Any material edit, recomputation, changed trusted reference, changed budget, changed deliverable set, changed rate/config input, or regenerated proposal creates a new revision/hash and requires new approval.

Do not silently recompute a materially different proposal after resume.

## Authorization is outside the prompt

Before resume or callback continuation:
- derive the authenticated actor server-side;
- derive the trusted organization/resource server-side;
- verify ownership of the run/artifact/domain object;
- verify the expected suspended step/resume target;
- validate typed resume data.

Browser-supplied run IDs, org IDs, brand IDs, shoot IDs, artifact IDs, and page context are claims until verified.

## Callback/webhook resume

External async continuation must bind both sides:

```text
expected workflow run
+
expected external job/crawl/provider operation ID
```

Reject mismatched, stale, duplicate, forged, or already-consumed callbacks. Authenticate provider callbacks where supported. Never let a callback bypass human review to write approved domain truth.

## Side-effect rule

Workflow snapshot persistence does not provide exactly-once business effects by itself.

Every consequential write must have a domain-level uniqueness/idempotency invariant. Test:
- duplicate resume;
- concurrent resume;
- approve vs reject race;
- failure before commit;
- failure after commit but before response;
- process restart before resume;
- retry after response loss.

The safe result after a post-commit response loss is: retry observes the already-committed state and does not repeat the write.

## Fail-closed provider behavior

Provider/model/network failure must not advance the workflow with stale or partial prior data unless the product contract explicitly allows a clearly marked degraded result.

Bound/redact upstream error text before persisting it into workflow state or logs.

## Secrets

Do not persist JWTs, service-role keys, provider credentials, sensitive headers, or equivalent secrets in workflow input, suspend/resume data, snapshots, working memory, model-visible state, or tracing payloads. Derive privileged capability at the server boundary.

## Required adversarial matrix for consequential workflows

At minimum verify:
- approve;
- reject;
- revision requested;
- close/cancel/timeout/disconnect;
- malformed resume;
- stale artifact revision;
- wrong run;
- wrong step;
- wrong tenant/resource;
- duplicate resume;
- concurrent resume;
- process restart while suspended;
- external callback replay/mismatch;
- provider failure after approval;
- commit succeeds but response is lost;
- no secret in persisted workflow state;
- exact approved artifact reaches the commit boundary.

## Proof order

```text
static workflow/side-effect inventory
→ pure schema/step tests
→ suspend/resume contract test
→ authorization/tenant negatives
→ duplicate/concurrency/idempotency
→ real storage close/reopen
→ provider/callback failure paths
→ typecheck/build
→ real operator HITL/browser proof only when required
→ exact deployed runtime proof
```

## Source priority

```text
current iPix workflow + task owner
→ installed @mastra/core source/types
→ embedded docs
→ current Mastra docs/MCP
→ migration notes/releases/issues for version-specific behavior
```

Current docs:
- https://mastra.ai/docs/workflows/overview
- https://mastra.ai/docs/workflows/control-flow
- https://mastra.ai/docs/workflows/snapshots
- https://mastra.ai/docs/workflows/suspend-and-resume
- https://mastra.ai/docs/workflows/error-handling
