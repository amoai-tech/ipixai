# ipix-task-lifecycle — deprecated compatibility alias

This directory is retained for historical prompts only. **Canonical new-work entrypoint:** [`../tasks/SKILL.md`](../tasks/SKILL.md).

Do not start new tasks from this skill or from `pr-workflow`. Use:

```text
live Linear task
→ tasks
→ relevant domain skill(s)
→ task-verifier
→ exact-head CI/review
→ post-merge proof
```

Legacy five-phase files remain available only to interpret old references:
plan → research → implement → test → ship.

## Canonical links

| Need | Owner |
|------|-------|
| Task execution/progress | [`tasks`](../tasks/SKILL.md) + live Linear |
| PR workflow | [`tasks/references/github-pr.md`](../tasks/references/github-pr.md) |
| Review comments | [`tasks/references/review-comments.md`](../tasks/references/review-comments.md) |
| Pre-merge tests | [`tasks/references/pre-merge-tests.md`](../tasks/references/pre-merge-tests.md) |
| Post-merge proof | [`tasks/references/post-merge.md`](../tasks/references/post-merge.md) |
| Done verification | [`task-verifier`](../task-verifier/SKILL.md) |

No local issue/todo mirror is required; live Linear is authoritative for task progress/evidence.
