# Phase 5 — Shipping

Coordinator for **closing the loop** — PR, live Linear, git commit, and post-merge evidence. **Mandatory** for every shipped issue.

**PR + threads:** [pr-workflow](../pr-workflow/SKILL.md) · **Done gate:** [task-verifier](../task-verifier/SKILL.md)

---

## Entry / exit criteria

| | Criterion |
|---|---|
| **Entry** | Phase 4 verify matrix green. Proofs captured. |
| **Exit** | **Never mark Done unless** Done gate in [SKILL.md](SKILL.md) is satisfied. PR merged (or waived) · threads resolved · post-merge proof recorded in Linear · user informed. |

---

## Shipping checklist

```
[ ]  1. Run the risk-matched verification from tasks/pre-merge-tests and capture evidence.
[ ]  2. Run task-verifier when required; document a justified trivial-work waiver only when allowed.
[ ]  3. Update the live Linear issue: acceptance criteria/progress, exact verification evidence, blockers, and next state.
[ ]  4. PR: all substantive review threads classified/resolved; current-head CI/review freshness recorded.
[ ]  5. Set Linear In Review while waiting on merge. Done only after tasks/post-merge proves the observable outcome.
[ ]  6. Self-review exact git diff — one concern, no secrets, no debug residue.
[ ]  7. Stage explicit task paths and commit with the repository task reference.
[ ]  8. Push / merge only if user explicitly asks.
[ ]  9. After merge: verify origin/main, main CI/deployment as applicable, task smoke/domain proof, then update Linear to 100% / Done.
[ ] 10. Worktree teardown only after documentation/evidence preservation and post-merge requirements are satisfied.
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
<type>(<area>): IPI-<n> <SPEC-ID> — <outcome>

Co-Authored-By: Claude <noreply@anthropic.com>
```

| type | When |
|------|------|
| `feat` | New capability |
| `fix` | Bug on shipped behavior |
| `refactor` | No behavior change |
| `docs` | Spec / todo / linear docs only |
| `chore` | Tooling, deps |
| `test` | Tests only |

| area | When |
|------|------|
| `plt` | Platform / auth / env |
| `ai` | Edge + Gemini |
| `dna` | DNA scoring |
| `ui` | Dashboard / operator UI |
| `com` | Commerce (Mercur) |
| `supabase` | Migrations / RLS |

---

## Linear update

Prefer the connected Linear MCP/API and write the verified task state directly to the live issue. Never require a nonexistent local markdown mirror as an intermediate source of truth. If Linear is unavailable, report the update as blocked rather than fabricating a local authoritative state.

---

## Push policy

| Action | Allowed |
|--------|---------|
| Local commit | Yes — every Phase 5 |
| Push to remote | User explicitly requests |
| Force-push main | Never |
| Push to `main` | Never — `ipi/*` branch + PR only |

---

## Rollback awareness

| Situation | Action |
|-----------|--------|
| Small forward fix | Follow-up commit; update todo row note |
| Bad migration | Rollback SQL from migration comment; repair per supabase/README |
| Broken edge fn | Redeploy previous version; reopen issue |
| Unclear regression | `git revert`; set Linear Back to In Progress |

---

## Routing

| Need | Route to |
|------|----------|
| Linear step format | [references/linear-issue-steps.md](references/linear-issue-steps.md) |
| Commit templates | [references/shipping-templates.md](references/shipping-templates.md) |
| Forensic Done gate | [task-verifier](../task-verifier/SKILL.md) |
| PR create, verify, threads, merge | [pr-workflow](../pr-workflow/SKILL.md) |
| After merge (verify main, Linear, risks, runtime) | [tasks post-merge](../tasks/references/post-merge.md) — merge ≠ Done |
| Worktree cleanup | [worktrees](../worktrees/SKILL.md) |

After Phase 5: use the live Linear project/dependency state to identify the next eligible task.
