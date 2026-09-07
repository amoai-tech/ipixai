---
name: tasks
description: >
  Standard for creating, enriching, executing, and tracking iPix Linear IPI tasks.
  Use for new task setup, task rewrites, Lumina-to-iPix migrations, file/workflow plans,
  progress trackers, and executable Linear prompts. Defines task structure; it does not
  replace ipix-task-lifecycle execution or task-verifier Done checks.
version: "1.0.0"
---

# tasks — iPix Linear task specification standard

**Purpose:** define what a production-ready Linear task must contain and how its live progress is maintained.

## Ownership

```text
tasks
= what a good executable Linear task contains

ipix-task-lifecycle
= how that task is executed through plan → research → implement → test → ship

task-verifier
= independent proof that the task is actually complete
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
12. PR evidence contract and post-merge production verification.

For detailed layout, read [task-format.md](references/task-format.md).
For progress rules, read [progress-tracker.md](references/progress-tracker.md).
For Lumina migrations, also read [migration-lumina.md](references/migration-lumina.md).

## Explicit action vocabulary

Never use `adapt` by itself. Use: **COPY**, **COPY + CLEAN**, **COPY + CLEAN TOKENS**, **PORT**, **REIMPLEMENT USING CURRENT iPix PATTERN**, **EXTRACT + REUSE**, **COPY UI STRUCTURE + REWRITE DATA/WORKFLOW LOGIC**, **REWRITE**, **MOVE TO IPI-XXX · TASK-ID — Full Task Name**, or **DROP**.

## Required execution behavior

- Use Graphify before broad multi-file reading.
- Inspect current clean `origin/main` before trusting the issue text.
- Reuse current iPix implementation before Lumina or custom code.
- Verify Supabase schema/RLS/index/RPC/live row shape read-only when data contracts matter.
- Implement one file/group at a time; do not bulk-copy folders.
- Run the cheapest reliable proof after each file/group before moving on.
- Update Linear progress after every verified checkpoint.
- If a completed checkpoint regresses, uncheck it and reduce the percentage.
- Never set `100%` or Linear `Done` until post-merge observable verification passes.

## Progress formula

```text
Overall completion % =
verified completed applicable checkpoints
÷ total applicable checkpoints
× 100
```

Verified `N/A` checkpoints are excluded from the denominator. Round to the nearest whole percent.

## Faster/better approach

At task start and each major phase ask once: **Is there a better, faster, more efficient way to complete this without weakening evidence?** Use that path.

## Handoff contract

A different agent must be able to resume from the Linear issue alone and know: current state, verified progress, exact next file/workflow, evidence, blockers, and remaining Done gates.
