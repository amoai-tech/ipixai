# Phase 4 — Testing

Aggregate verification after Phase 3. **Per-task tests already ran in Phase 3** —
this phase confirms full-matrix coverage and captures ship evidence.

**Playbook:** [`docs/process/04-testing-qa-playbook.md`](../../../docs/process/04-testing-qa-playbook.md) · **Evidence:** [`qa-evidence-template.md`](../../../docs/process/templates/qa-evidence-template.md)
Matrix: [references/testing-matrix.md](references/testing-matrix.md) · per-task contract:
[references/per-task-testing.md](references/per-task-testing.md) · path commands: [verify-matrix](../pr-workflow/references/verify-matrix.md).

---

## Entry / exit criteria

| | Criterion |
|---|---|
| **Entry** | All plan tasks complete. Each task's `Test` command passed in Phase 3. |
| **Exit** | Aggregate gates pass. Smoke evidence captured. Linear verify checkboxes ready for Phase 5. |

---

## Required gates

Use [tasks pre-merge tests](../tasks/references/pre-merge-tests.md) as the canonical risk matrix. Re-read root `package.json` and `.github/workflows/ci.yml`; do not duplicate stale path-specific commands here.

Current root capabilities include targeted/full Vitest (`npm test`), `npm run typecheck`, `npm run build`, and Playwright `e2e*` scripts. There is no root lint script. Run the cheapest proof that covers the changed risk, then escalate to build/browser/preview only when required.

For user-facing or AI-native flows, apply [tasks user-journey testing](../tasks/references/user-journey-testing.md). Explorbot is an exploratory pilot, not a mandatory merge gate.

## Workflow checklist

```
[ ] 1. Confirm every Phase 3 leaf checkpoint has PASS evidence.
[ ] 2. Map each affected acceptance criterion/risk to the tasks pre-merge matrix.
[ ] 3. Run targeted tests first; run broader `npm test` only when scope/risk justifies it.
[ ] 4. Run `npm run typecheck`; run `npm run build` when route/config/runtime risk requires production-build proof.
[ ] 5. Run SQL/Supabase, Playwright, preview, or live-provider proof only when the changed boundary requires it.
[ ] 6. Record command, result, environment, tested SHA, and any justified N/A gate in Linear.
[ ] 7. Any unexplained P0/P1 failure or critical flake loops back to implementation.
[ ] 8. Hand off to shipping.md only after required evidence is green.
```

---

## Failure triage

1. Identify which **task** introduced the failure (git bisect or plan order).
2. Re-run that task's Vitest command in isolation.
3. Classify: test wrong → fix test; code wrong → Phase 3; flake → stable wait/assert.
4. Never `it.skip` without follow-up IPI issue.

---

## Routing

| Need | Route to |
|------|----------|
| Per-task contract | [references/per-task-testing.md](references/per-task-testing.md) |
| Matrix details | [references/testing-matrix.md](references/testing-matrix.md) |
| Test authoring | [gen-test](../gen-test/SKILL.md) |
| Forensic Done gate | [task-verifier](../task-verifier/SKILL.md) |

Hand off to [shipping.md](shipping.md) when gates green.
