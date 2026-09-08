---
name: task-verifier
description: >
  Adversarial independent evidence gate for iPix tasks and PRs. Use for task review, merge-safety,
  failure-mode analysis, audits of completion claims, and before Linear Done. Consumes the canonical
  `tasks` standard, exact current code/PR head, tests/CI/runtime, and affected domain skills. It tries
  to disprove unsafe or incomplete claims rather than maintaining a parallel implementation lifecycle.
version: "2.2.0"
---

# task-verifier — adversarial evidence gate

**Core mindset:** **try to disprove Done.** Ask what could make the task wrong, incomplete, unsafe, misleadingly green, or fail in production, then require evidence that eliminates those failure modes.

Do not trust status fields, prior-agent summaries, bot approvals, old task markdown, checked boxes, or earlier green runs without current evidence.

## Ownership

```text
tasks         = define + execute substantial iPix work
domain skills = implementation-specific contracts
task-verifier = independently challenge claims and prove merge safety / Done
```

Before substantial verification, read [`../tasks/SKILL.md`](../tasks/SKILL.md). Do not recreate its implementation process.

## Modes

| Mode | Use when | Depth |
|---|---|---|
| **Quick** | small fix, docs/process, narrow PR/status check | 1–3 decisive probes; stop on blocker |
| **Standard** | normal feature/task/PR review | task validity + AC map + failure modes + false-green + domain checks |
| **Adversarial** | auth/RLS/tenant, HITL/consequential AI, migration/data integrity, production config/release, security-sensitive dependency, destructive/publishing/payment write, Mastra workflow resume/callback/storage/tenant-memory/cancellation/MCP-auth changes | Standard + hostile/negative/recovery/rollback/supply-chain proof |

Default: **Standard** for `verify/review/audit task`; **Quick** only when the request is explicitly narrow; **Adversarial** automatically for the risk triggers above or when the user asks for production/security readiness.

Active references:
- [Quick gate](references/quick-gate.md)
- [Standard + adversarial protocol](references/adversarial-gate.md)
- [Domain best-practice scan](references/domain-best-practices.md)
- [Full scoring](references/task-spec-rubric.md)
- [Anti-fake-Done](references/anti-fake-done-checklist.md)

Everything under `references/legacy/` and `scripts/legacy/` is historical compatibility material, not current iPix guidance.

## Evidence priority

Use the cheapest authoritative proof that answers the claim:

1. Current runtime/live state when applicable.
2. Exact current branch/PR head and changed code.
3. Targeted tests and exact-head CI.
4. Live Linear acceptance criteria and current task state.
5. `AGENTS.md` + `tasks/SKILL.md`.
6. Affected domain skill and connected live/MCP evidence.
7. Installed dependency source/types/lockfile.
8. Official version-specific vendor docs/repositories when still needed.

Memory, reviewer prose, scores, and status labels are not proof.

## Required verification flow

1. **Task validity audit:** prove the gap still exists; detect stale assumptions, duplicate work, wrong architecture, obsolete APIs/files/routes, and ACs that do not prove the real user outcome.
2. **Exact head:** record branch/PR SHA and changed paths before evaluating implementation evidence.
3. **AC map:** classify every applicable AC as `VERIFIED`, `PARTIAL`, `UNVERIFIED`, or `FAILED` with concrete evidence.
4. **Adversarial pre-mortem:** identify likely failure points and record a failure-mode matrix: trigger, impact, protection, proof, status.
5. **False-green gate:** ask whether all listed tests could pass while the operator/business outcome is still broken; convert plausible false greens into missing proof.
6. **Domain best practices:** load only affected domain skills and run the relevant checks from [domain-best-practices.md](references/domain-best-practices.md).
   - For material Supabase/Postgres changes, determine which independent proof classes apply: **catalog, behavioral, authorization/tenant, migration replay, performance/exposure, live read-only**. Do not substitute one proof class for another; use `ipix-supabase/references/verification-matrix.md` for HOW.
   - For material Mastra changes, determine which independent proof classes apply: **registry/config, deterministic primitive, model behavior, authority/context, memory, persistence/restart, HITL artifact, resume/recovery, streaming/abort, side-effect idempotency, observability/evals, exact runtime**. Do not substitute one proof class for another; use the `mastra` skill for HOW.
7. **Negative/recovery:** verify malformed/empty/stale/large input, provider/network failure, retry, idempotency, partial failure, refresh/back/navigation, and unauthorized/cross-tenant behavior when applicable.
8. **AI behavior:** for AI-native work test positive and negative behavior: should-act/should-not-act, correct/wrong tool, valid/invalid arguments, approval granted/rejected/absent, prompt-injection/excessive-agency attempts, and no durable write before approval.
9. **Supply chain:** when manifests, lockfiles, actions, containers, or external SDK versions change, review unexpected dependencies, compatibility, vulnerabilities, permissions, licensing, and pinning/upgrade risk.
10. **Operations:** for deployment-affecting work prove failure detection, retry safety, rollback/containment, rollback triggers, migration compatibility, and immediate monitoring signals.
11. **Journey:** for user-facing work verify the complete business journey using [`../tasks/references/user-journey-testing.md`](../tasks/references/user-journey-testing.md).
12. **Exact-head proof:** required CI/reviews/tests must apply to the current head; older green evidence is stale after a push.
13. **Post-merge:** when claiming Done require applicable [`../tasks/references/post-merge.md`](../tasks/references/post-merge.md) evidence. Merge alone is insufficient.
14. **Verdict:** blockers first, then high/medium findings, then improvements. Missing required evidence means not Done.

## Mastra false-green gate

When Mastra participates, explicitly ask whether all current tests could pass while any of these remain broken:

```text
forced toolChoice passes but natural language selects the wrong tool
shared/stale thread makes persistence look correct
message row persists but a new process never uses it
browser-supplied org/brand/shoot context is trusted without server verification
approved revision N differs from revision/hash actually resumed or saved
approved:false/cancel/close falls back into another suspend path
a proposal is materially recomputed after the operator approved it
Stop closes the UI stream but external/provider/tool work keeps running
duplicate callback/resume repeats a write/payment/publish/booking
provider failure falls through to stale output that appears successful
JWT/service/provider secret lands in workflow snapshot, memory, trace, or model context
trace reports success while the operator/business outcome failed
```

If any scenario is plausible, require a decisive proof before PASS.

## Mastra proof non-substitution rules

```text
tool unit test passes        ≠ model routing proof
model routes correctly       ≠ caller authorization proof
resource/thread ID known     ≠ ownership proof
message persisted            ≠ restart recall proof
approved=true                ≠ exact artifact approval
resume succeeds              ≠ stale/duplicate/foreign resume safety
stream ends                  ≠ downstream abort proof
single write succeeds        ≠ retry/idempotency proof
trace exists                 ≠ business success proof
```

## Severity taxonomy

| Severity | Meaning | Effect |
|---|---|---|
| **BLOCKER** | tenant/secret/data-loss/destructive-write/HITL/unsafe-migration/required-AC/exact-head critical failure | Not ready regardless of score |
| **HIGH** | likely production correctness/reliability/security failure with meaningful impact | fix before Done unless explicitly proven non-blocking |
| **MEDIUM** | material weakness or unproved edge case that does not invalidate the main outcome | document/fix before Done when required by AC/risk |
| **IMPROVEMENT** | maintainability/efficiency/readability with no current outcome risk | non-blocking |
| **OUT-OF-SCOPE** | valid issue owned elsewhere | cite exact owner; do not hide a blocker here |
| **NOISE** | incorrect, stale, or non-actionable finding | dismiss with evidence |

Finding categories: `CORRECTNESS`, `SECURITY`, `DATA-INTEGRITY`, `RELIABILITY`, `ARCHITECTURE`, `USER-JOURNEY`, `AI-SAFETY`, `TEST-GAP`, `OPERATIONS`, `PERFORMANCE`, `MAINTAINABILITY`, `STALE-SPEC`.

## Scoring rule

Only **Standard** or **Adversarial** may publish a score, and only when the evidence is sufficiently complete. If material evidence is missing, label the score **provisional** or omit it. Never let a high score override a BLOCKER.

## Hard Done rule

`code exists` ≠ Done
`tests pass` ≠ automatically Done
`PR merged` ≠ Done
**required observable outcome + risk-matched adversarial evidence + applicable post-merge proof = Done**

## Agent prompt

```text
Independently review this task and try to disprove Done. Read the live Linear task and `.claude/skills/tasks/SKILL.md`. Verify the task itself is still valid before evaluating implementation. Record the exact current branch/PR SHA. Map every AC to current evidence. Build a failure-mode matrix and identify plausible false-green scenarios where tests could pass but the real user outcome would still fail. Load only affected domain skills and check their current best-practice/security contracts. Automatically use Adversarial mode for auth/RLS/tenant, HITL/consequential AI, migrations/data integrity, production config/release, security-sensitive dependency changes, publishing/payments, destructive writes, and Mastra workflow resume/callback/storage/tenant-memory/cancellation/MCP-auth changes. For material Mastra work identify the independent applicable proof classes and do not substitute tool tests for routing, persistence for restart recall, stream closure for abort, or approval booleans for exact reviewed-artifact proof. Test retry/idempotency/partial-failure/recovery where state can change; review supply-chain risk when manifests/lockfiles/actions change; require rollback/monitoring proof for deployment-affecting work. Classify findings by severity and category. Treat missing required evidence as not Done. Use numeric scores only when evidence is complete enough to justify them. End with the smallest fixes/proofs required to reach verified Done.
```
