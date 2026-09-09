---
name: ipix-task-lifecycle
description: >
  Deprecated compatibility shim for older iPix prompts that still reference the former
  five-phase task lifecycle. Do not select for new substantial IPI work; use `tasks` instead.
version: "2.0.0"
---

# ipix-task-lifecycle — deprecated compatibility shim

> **Deprecated:** new iPix task work must use [`tasks`](../tasks/SKILL.md). This skill is retained only so older prompts and historical references fail safely instead of disappearing.

## Canonical replacement

```text
tasks/SKILL.md
→ task definition + execution checkpoints + progress
→ research/domain routing
→ pre-commit + risk-matched testing
→ PR/review/CI
→ user-journey proof
→ post-merge verification

task-verifier/SKILL.md
→ independent evidence gate before Done
```

Do not maintain a second Plan → Research → Implement → Test → Ship standard here. Do not add new planning, testing, shipping, Linear-SSOT, PR, or command rules to this skill.

## Compatibility behavior

When an older task or prompt routes here:

1. Read [`../tasks/SKILL.md`](../tasks/SKILL.md).
2. Treat live Linear as the task execution/progress source of truth.
3. Load only the task references and domain skills applicable to the current work.
4. Use [`../task-verifier/SKILL.md`](../task-verifier/SKILL.md) for independent verification.
5. If an old lifecycle reference conflicts with `tasks`, `AGENTS.md`, current code/runtime, or current package scripts, follow the current source and report the stale reference.

## Do not use for new work

- Do not require this skill in new Linear tasks.
- Do not add it to new `Skills:` lists.
- Do not require old `docs/linear/issues/` mirrors or `tasks/plan/todo.md` trackers.
- Do not route PR work through this skill.
- Do not update the old phase/reference documents except to fix a compatibility break in historical material.

## Agent prompt

```text
This compatibility skill is deprecated. Stop using its old five-phase procedures as an execution standard. Load `.claude/skills/tasks/SKILL.md`, identify the applicable task references and domain skills, and continue from the live Linear task/current repository state. Use `task-verifier` only as the independent evidence gate. Report any legacy instruction that conflicts with current sources instead of reproducing it.
```
