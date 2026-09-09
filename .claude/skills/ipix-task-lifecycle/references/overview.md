# ipix-task-lifecycle — compatibility index

This legacy five-phase material is preserved for old prompts only. **New work must start from [`tasks`](../../tasks/SKILL.md)**, which owns substantial task execution, PR review, CI, and post-merge proof.

Legacy conceptual phases remain available for compatibility:
**plan → research → implement → test → ship**.

## Start here

```text
.claude/skills/tasks/SKILL.md
```

Do not load `ipix-task-lifecycle` or `pr-workflow` as the primary workflow for new work.

## Legacy phase modules

| Phase | Compatibility file |
|-------|--------------------|
| Plan | [planning.md](../planning.md) |
| Research | [research.md](../research.md) |
| Implement | [implementation.md](../implementation.md) |
| Test | [testing.md](../testing.md) |
| Ship | [shipping.md](../shipping.md) |

Each compatibility file must defer to the canonical `tasks` contract when instructions conflict.

## Canonical routing

| Need | Owner |
|------|-------|
| Task structure/progress | [`tasks`](../../tasks/SKILL.md) + live Linear |
| PR creation/verification | [`tasks/references/github-pr.md`](../../tasks/references/github-pr.md) |
| Review comments | [`tasks/references/review-comments.md`](../../tasks/references/review-comments.md) |
| Pre-merge tests | [`tasks/references/pre-merge-tests.md`](../../tasks/references/pre-merge-tests.md) |
| Post-merge proof | [`tasks/references/post-merge.md`](../../tasks/references/post-merge.md) |
| Independent Done gate | [`task-verifier`](../../task-verifier/SKILL.md) |
| Domain HOW | relevant domain skill |

## Useful compatibility references

- [linear-issue-steps.md](linear-issue-steps.md)
- [linear-prompt-engineering.md](linear-prompt-engineering.md)
- [domain-skill-routing.md](domain-skill-routing.md)
- [linear-spec-template.md](linear-spec-template.md)
- [prd-template.md](prd-template.md)
- [per-task-testing.md](per-task-testing.md)
- [migration-safety.md](migration-safety.md)
- [testing-matrix.md](testing-matrix.md)

Live Linear is the task/progress/evidence source of truth. Do not recreate obsolete local todo/issue mirrors.
