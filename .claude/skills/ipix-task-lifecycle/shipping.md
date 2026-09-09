# Phase 5 — Shipping

Deprecated lifecycle compatibility coordinator for closing the loop. The canonical task/PR/post-merge workflow is `.claude/skills/tasks/SKILL.md` and its references.

**PR + threads:** [tasks PR guidance](../tasks/references/github-pr.md) + [review comments](../tasks/references/review-comments.md) · **Done gate:** [task-verifier](../task-verifier/SKILL.md)

---

## Entry / exit criteria

| | Criterion |
|---|---|
| **Entry** | Required risk-matched verification is green. Proofs captured. |
| **Exit** | **Never mark Done unless** the canonical tasks post-merge gate and task-verifier requirements are satisfied. PR merged (or explicitly waived) · substantive threads resolved · post-merge proof recorded in Linear · user informed. |

---

## Shipping checklist

```
[ ]  1. Run the risk-matched verification from tasks/references/pre-merge-tests.md and capture evidence.
[ ]  2. Run task-verifier when required; document a justified trivial-work waiver only when allowed.
[ ]  3. Update the live Linear issue: acceptance criteria/progress, exact verification evidence, blockers, and next state.
[ ]  4. PR: all substantive review threads classified/resolved; current-head CI/review freshness recorded.
[ ]  5. Set Linear In Review while waiting on merge. Done only after tasks/references/post-merge.md proves the observable outcome.
[ ]  6. Self-review exact git diff — one concern, no secrets, no debug residue.
[ ]  7. Stage explicit task paths and commit with the repository task reference.
[ ]  8. Push / merge only if user explicitly asks.
[ ]  9. After merge: verify origin/main, main CI/deployment as applicable, task smoke/domain proof, then update Linear to 100% / Done.
[ ] 10. Worktree teardown only after evidence preservation and post-merge requirements are satisfied.
```

## Canonical records

| Record | Authority | Required update |
| -- | -- | -- |
| Task execution/progress | Live Linear issue | AC/progress, evidence, blocker/next state |
| Code/review | Git commit + PR | exact diff, review threads, tested/reviewed head SHA |
| Runtime proof | CI/deployment/domain evidence | post-merge result when applicable |

A local issue/todo mirror is not mandatory. If a future task deliberately introduces one, that task must define synchronization direction and ownership; do not recreate old `docs/linear/issues/` or `tasks/plan/todo.md` conventions by default.

---

## Templates

See [references/shipping-templates.md](references/shipping-templates.md).

### Commit message

```
<type>(<area>): IPI-<n> <TASK-ID> — <outcome>

Co-Authored-By: Claude <noreply@anthropic.com>
```

## Linear update

Prefer the connected Linear MCP/API and write the verified task state directly to the live issue. Never require a nonexistent local markdown mirror as an intermediate source of truth. If Linear is unavailable, report the update as blocked rather than fabricating a local authoritative state.

---

## Push policy

| Action | Allowed |
|--------|---------|
| Local commit | Yes when task execution authorizes it |
| Push to remote | User explicitly requests |
| Force-push main | Never |
| Push to `main` | Never — `ipi/*` branch + PR only |

---

## Rollback awareness

| Situation | Action |
|-----------|--------|
| Small forward fix | Follow-up commit; update Linear evidence |
| Bad migration | Follow owning Supabase rollback/recovery plan; reopen task |
| Broken edge fn | Restore previous known-good version; reopen task |
| Unclear regression | `git revert`; set Linear back to In Progress |

---

## Routing

| Need | Route to |
|------|----------|
| Canonical task/PR workflow | [tasks](../tasks/SKILL.md) |
| PR create/verify | [tasks PR guidance](../tasks/references/github-pr.md) |
| Review comments/threads | [tasks review comments](../tasks/references/review-comments.md) |
| Forensic Done gate | [task-verifier](../task-verifier/SKILL.md) |
| After merge | [tasks post-merge](../tasks/references/post-merge.md) |
| Worktree cleanup | [worktrees](../worktrees/SKILL.md) |

After Phase 5: use live Linear project/dependency state to identify the next eligible task.
