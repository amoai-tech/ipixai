---
name: pr-workflow
description: >
  Deprecated compatibility shim for older prompts that reference the former standalone iPix
  PR workflow. New PR creation, review troubleshooting, CI, and post-merge proof are owned by `tasks`.
version: "2.0.0"
---

# pr-workflow — deprecated compatibility shim

> **Deprecated:** use [`tasks`](../tasks/SKILL.md) for new PR work.

The PR responsibilities formerly owned here are now split into focused task references:

| Need | Canonical reference |
|---|---|
| Pre-commit defect prevention | [`tasks/references/pre-commit.md`](../tasks/references/pre-commit.md) |
| Risk-matched verification | [`tasks/references/pre-merge-tests.md`](../tasks/references/pre-merge-tests.md) |
| PR creation / merge readiness | [`tasks/references/github-pr.md`](../tasks/references/github-pr.md) |
| Review-comment triage | [`tasks/references/review-comments.md`](../tasks/references/review-comments.md) |
| Domain routing / evidence | [`tasks/references/domain-routing.md`](../tasks/references/domain-routing.md) |
| GitHub Actions / exact-head CI | [`tasks/references/github-actions.md`](../tasks/references/github-actions.md) |
| Post-merge proof | [`tasks/references/post-merge.md`](../tasks/references/post-merge.md) |

## Compatibility behavior

When an older prompt invokes `pr-workflow`, immediately route to `tasks/SKILL.md` and the applicable references above. Do not maintain or extend a second PR checklist, verify matrix, thread taxonomy, or post-merge standard in this skill.

Historical files under `pr-workflow/references/` remain compatibility material only. If they conflict with `tasks`, `AGENTS.md`, current CI, or current repository scripts, the current source wins and the conflict should be reported.

## Agent prompt

```text
Treat this skill as a deprecated alias. Load `.claude/skills/tasks/SKILL.md`, then use the current pre-commit, pre-merge, GitHub PR, review-comments, GitHub Actions, and post-merge references. Do not execute or extend the legacy standalone PR workflow when the canonical tasks references cover the same responsibility.
```
