---
name: tasks
description: >
  Standard for creating, enriching, executing, and tracking iPix Linear IPI tasks.
  Use for new task setup, task rewrites, Lumina-to-iPix migrations, file/workflow plans,
  progress trackers, executable Linear prompts, pre-commit quality gates, GitHub PR creation,
  review-comment troubleshooting, and post-merge proof. Defines the task standard; it does not
  replace task-verifier Done checks.
version: "1.8.0"
---

# tasks — iPix Linear task specification standard

**Purpose:** define and execute substantial iPix Linear work end-to-end while keeping live Linear as the resumable progress/evidence contract.

## Ownership

```text
tasks
= define + execute substantial iPix task work end-to-end

domain skills
= implementation-specific contracts for Supabase, Mastra, CopilotKit, Cloudinary, Next.js, etc.

task-verifier
= independent evidence gate that proves claims and Done
```

The Linear issue is the live task-specific execution runbook and progress source of truth.

## Mandatory task structure

Every substantial executable `IPI-*` task must include, when applicable:

1. Current verified setup on `origin/main` and live services.
2. Exact user/business outcome.
3. Observable Definition of Done.
4. Architecture connections, ownership, dependencies, blockers, and related tasks.
5. Source → explicit instruction → target mapping for reused or migrated code.
6. Pre-implementation gates: clean worktree, skills, Graphify, code, live contracts.
7. STOP conditions that force plan correction before coding.
8. Ordered implementation by file or tightly coupled workflow group.
9. Success criteria + verification checkpoint for every implementation step.
10. Live progress tracker with overall percentage and file/workflow checklists.
11. Test-data strategy, negative paths, tenant/security proof when relevant.
12. Pre-commit defect-prevention, PR evidence, review-resolution, exact-head CI, and post-merge production verification.
13. Agent Contract, known context, decision branches, stop conditions, and handoff state for long-running agent work.

For agent-prompt structure, read [agent-instructions.md](references/agent-instructions.md).
For detailed layout, read [task-format.md](references/task-format.md).
For progress rules, read [progress-tracker.md](references/progress-tracker.md).
For Lumina migrations, also read [migration-lumina.md](references/migration-lumina.md).
Before commit, read [pre-commit.md](references/pre-commit.md), then choose the risk-matched verification set from [pre-merge-tests.md](references/pre-merge-tests.md).
For PR creation/troubleshooting, read [github-pr.md](references/github-pr.md), [review-comments.md](references/review-comments.md), [domain-routing.md](references/domain-routing.md), [research-evidence.md](references/research-evidence.md), and [github-actions.md](references/github-actions.md).
For user-facing or AI-native workflows, read [user-journey-testing.md](references/user-journey-testing.md).
For UI-heavy work, read [ui-review.md](references/ui-review.md).
After merge, read [post-merge.md](references/post-merge.md). Legacy `ipix-task-lifecycle` and `pr-workflow` skills are compatibility aliases only; do not add them to new task skill lists.

## Explicit action vocabulary

Never use `adapt` by itself. Use: **COPY**, **COPY + CLEAN**, **COPY + CLEAN TOKENS**, **PORT**, **REIMPLEMENT USING CURRENT iPix PATTERN**, **EXTRACT + REUSE**, **COPY UI STRUCTURE + REWRITE DATA/WORKFLOW LOGIC**, **REWRITE**, **MOVE TO IPI-XXX · TASK-ID — Full Task Name**, or **DROP**.

## Required execution behavior

- Use Graphify before broad multi-file reading.
- Inspect current clean `origin/main` before trusting the issue text.
- Reuse current iPix implementation before Lumina or custom code.
- Before implementation, classify risk domains: auth/tenant, Supabase schema/migration, privileged DB function/RPC, consequential AI/HITL, external side effect/webhook, payment/publishing, production config, dependency/Action. Any high-risk domain requires Adversarial task-verifier coverage.
- For Mastra work, also classify applicable risk domains: **agent registry/identity, model/provider, tool schema, tool authority, external side effect, RequestContext/tenant context, memory resource/thread scope, persistent storage, streaming/Stop/abort, workflow, suspend/resume, HITL approval, MCP, observability/evals, Mastra package-family change**. Tenant identity, memory ownership, consequential tools, approval/resume, callback/webhook continuation, persistent storage, cancellation, MCP auth, or package-family changes automatically require Adversarial task-verifier coverage.
- Record verification ownership: **WHAT must be proven → task-verifier; HOW domain correctness is proven → owning domain skill; automated regression → test/CI owner.**
- For Supabase/Postgres work, identify applicable proof classes before coding: catalog, behavioral, authorization/tenant, migration replay, performance/exposure, live read-only. Route the HOW to `ipix-supabase`; never reconstruct an existing DB object from memory or task prose.
- For Mastra work, identify applicable proof classes before coding: registry/config, deterministic primitive, model behavior, authority/context, memory, persistence/restart, HITL artifact, resume/recovery, streaming/abort, side-effect idempotency, observability/evals, exact runtime. Route the HOW to `mastra`; do not let one proof class substitute for another.
- Implement one file/group at a time; do not bulk-copy folders.
- For Lumina migrations, classify mixed-responsibility files at the **symbol/behavior/invariant** level, not one blanket action per file. Pin immutable source SHAs and record current owner/source of truth, legacy risk, target, and proof for every reused behavior.
- Run the cheapest reliable proof after each file/group before moving on.
- Keep requirement/user outcome separate from the recommended implementation so current evidence can improve the plan without changing the goal.
- Provide known relevant context, explicit IF → THEN edge cases, successful-stop conditions, and invalid-assumption STOP conditions.
- Use examples for ambiguous migration/reuse instructions instead of vague verbs.
- Before commit, run the pre-commit defect-prevention gate, local automated review when available, and the risk-matched pre-merge test matrix; verify load-bearing external contracts.
- Treat PR comments as hypotheses: classify, route to the owning domain skill/MCP, verify, then fix/reply/resolve with evidence.
- Define affected business-critical user journeys and certify both system correctness and AI correctness when AI participates.
- Named third-party testing/review tools are not iPix defaults unless this repository contains a pinned, reproducible setup or an explicit approved task owns the adoption decision. Explorbot is the currently selected exploratory-testing pilot; it is not a mandatory merge gate until a repository-owned path is approved.
- Use Mermaid/wireframes when they materially clarify architecture, ownership, authorization, HITL, or UI states.
- Update Linear progress after every verified checkpoint.
- If a completed checkpoint regresses, uncheck it and reduce the percentage.
- Never set `100%` or Linear `Done` until post-merge observable verification passes.

## Progress formula

```text
Overall completion % =
verified applicable leaf units with `Done [x]`
÷ total applicable leaf units
× 100
```

Parent workflow rows are roll-ups only when expanded into child rows. Implementation/Verification boxes are gates, not separate percentage units. Verified `N/A` leaf units are excluded from the denominator. Round to the nearest whole percent.

## Faster/better approach

At task start and each major phase ask once: **Is there a better, faster, more efficient way to complete this without weakening evidence?** Use that path.

## Handoff contract

A different agent must be able to resume from the Linear issue alone and know: current state, verified progress, exact next file/workflow, evidence, blockers, and remaining Done gates.

## Core agent prompt

```text
You are executing one substantial iPix Linear task. Read this skill and only the references applicable to the current phase. Verify current code/runtime before trusting task assumptions. Keep the user outcome separate from the proposed implementation, use the smallest safe solution, and record evidence after each checkpoint. Use the owning domain skill/MCP for uncertain external contracts. For Mastra/Lumina work, classify behavior-level reuse and independent Mastra proof classes before coding. Do not speculate about files or APIs you have not inspected. Stop and update Linear when a STOP condition invalidates the plan. Finish only when the observable Definition of Done and required post-merge proof are verified.
```
