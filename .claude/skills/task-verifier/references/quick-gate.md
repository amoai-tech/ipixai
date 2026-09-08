# Quick gate — minimum decisive evidence

Use for PR/merge safety, docs/process changes, small fixes, and status checks. Parent: [`../SKILL.md`](../SKILL.md).

## Rule

Use **1–3 decisive probes** whenever possible. Stop at the first confirmed blocker; do not run a full audit merely to produce a score.

```text
current task/outcome
→ exact current head/diff
→ smallest relevant proof
→ affected domain skill only if needed
→ Safe / Not ready
```

## Minimum checks

| Change | Typical minimum |
|---|---|
| Docs/process | exact diff, internal consistency, relevant links/commands exist |
| Code fix | exact diff, targeted regression test, typecheck when TS contract changed |
| UI | targeted test + Playwright/browser proof when observable behavior changed |
| Supabase/security | relevant SQL/RLS/RPC proof + tenant denial when boundary changed |
| PR state | exact-head CI/review freshness + unresolved substantive threads |

Escalate to Full when the user asks if the task is Done/production-ready, evidence conflicts, or the task affects production/security/tenant/HITL boundaries.

## Report

```markdown
## Gate — IPI-XXX · TASK-ID — Full Task Name

**Verdict:** ✅ Safe / 🛑 Not ready
**Confidence:** High / Medium / Low

| Claim | Evidence | Result |
|---|---|---|
| ... | ... | ✅ / 🟡 / 🔴 |

### Blockers
- ...

### Missing evidence / risks
- ...

### Next action
- <smallest action required>
```

Do not publish a numeric score in Quick mode.
