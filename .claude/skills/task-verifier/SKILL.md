---
name: task-verifier
description: >
  Independent evidence gate for iPix tasks and PRs. Use for "verify this task", merge-safety
  checks, audits of completion claims, and before Linear Done. Consumes the canonical `tasks`
  standard, current code/PR head, tests/CI/runtime, and affected domain skills. It does not
  define a parallel task lifecycle or implementation process.
version: "2.0.0"
---

# task-verifier — independent evidence gate

**Purpose:** answer one question: **does current evidence prove the required iPix outcome?**

Do not trust status fields, prior-agent summaries, bot approvals, old task markdown, or checked boxes without re-verification.

## Ownership

```text
tasks
= define + execute the work

domain skills
= verify domain-specific implementation contracts

task-verifier
= independently prove claims / acceptance criteria / Done
```

Before substantial verification, read [`../tasks/SKILL.md`](../tasks/SKILL.md). Do not recreate its task format, lifecycle, PR process, or testing matrix here.

Active references:
- [Quick gate](references/quick-gate.md)
- [Full scoring](references/task-spec-rubric.md)
- [Anti-fake-Done](references/anti-fake-done-checklist.md)

Everything under `references/legacy/` and `scripts/legacy/` is historical compatibility material, not current verification guidance.

## Quick vs Full

| Mode | Use when | Output |
|---|---|---|
| **Quick** | PR/merge safety, small fix, docs/process change, status check | minimum decisive probes + Safe / Not ready |
| **Full** | before Done, security/tenant boundary, production release, consequential AI/runtime change | AC-by-AC proof + journey/domain/runtime evidence + scored report |

Default: **Quick**, except a request asking whether work is Done/production-ready automatically uses **Full**.

## Evidence priority

Use the cheapest authoritative proof that answers the claim:

1. Current runtime/live state when applicable.
2. Exact current branch/PR head and changed code.
3. Targeted tests and exact-head CI.
4. Live Linear acceptance criteria and current task progress.
5. `AGENTS.md` + `tasks/SKILL.md`.
6. Affected domain skill and connected live/MCP evidence.
7. Installed dependency source/types/lockfile.
8. Official version-specific vendor docs/repositories when still needed.

Memory, reviewer prose, and status labels are not proof.

## Verification flow

1. **Outcome:** identify the real user/business outcome and observable Definition of Done from live Linear.
2. **Head:** record exact branch/PR SHA and changed paths.
3. **AC map:** classify every applicable acceptance criterion as `VERIFIED`, `PARTIAL`, `UNVERIFIED`, or `FAILED`.
4. **Domain:** load only domain skills touched by the changed paths; verify the skill/MCP actually exists before relying on it.
5. **Proof:** run the smallest decisive probes first; escalate only where cheaper proof is insufficient.
6. **Journey:** for user-facing work, verify the complete business journey using [`../tasks/references/user-journey-testing.md`](../tasks/references/user-journey-testing.md).
7. **AI:** when AI participates, verify both system correctness and AI correctness with the current iPix test/runtime stack. Explorbot may supplement exploration but is not a mandatory gate.
8. **Post-merge:** when claiming Done, require the applicable [`../tasks/references/post-merge.md`](../tasks/references/post-merge.md) evidence. Merge alone is insufficient.
9. **Verdict:** blockers first, then warnings/improvements. Missing required evidence means not Done.

## Domain evidence examples

| Domain | Minimum relevant proof |
|---|---|
| Supabase/Postgres | migration/RLS/RPC/constraint proof + tenant denial where applicable |
| CopilotKit/AG-UI | route/runtime contract + thread/interrupt/HITL path when changed |
| Mastra | deterministic tool/workflow behavior + persistence/suspend/resume only when changed |
| Cloudinary | signing/config/webhook/idempotency + real media path only when AC requires it |
| Next/UI | targeted Vitest/component proof + Playwright for observable route/auth/responsive behavior |
| Security/tenant | Org A allowed + Org B denied, no privileged/client-secret bypass |

Do not run unrelated domain gates merely to inflate coverage.

## Quick gate

Quick mode uses **1–3 decisive probes** whenever possible. Stop on the first confirmed blocker.

Report:

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

Do not invent a numeric score in Quick mode.

## Full gate

Full verification must include:

- exact task outcome and current head SHA
- acceptance-criteria evidence table
- user-journey proof when applicable
- security/tenant/HITL proof when applicable
- exact targeted tests/typecheck/build/E2E/CI/runtime evidence required by the change risk
- blockers and residual risks
- post-merge proof when claiming Done

### Full scoring

| Dimension | Weight |
|---|---:|
| Outcome / AC proof | 30 |
| Implementation correctness | 20 |
| Test / verification evidence | 20 |
| Security / tenant / safety | 15 |
| Architecture / source-of-truth alignment | 10 |
| Process / skill compliance | 5 |

Any unresolved critical blocker means **Not ready regardless of score**. Do not invent precision when evidence is incomplete; label scores provisional.

## Hard Done rule

`code exists` ≠ Done
`tests pass` ≠ automatically Done
`PR merged` ≠ Done
**required observable outcome + applicable post-merge evidence verified = Done**

## Agent prompt

```text
Review this task independently. Read the live Linear task and `.claude/skills/tasks/SKILL.md`, identify the observable outcome, inspect the exact current branch/PR head, and map every acceptance criterion to evidence. Use the cheapest authoritative proof: runtime → current code/head → tests/CI → live data → domain skill/MCP → installed source/types → official docs. Load only affected domain skills. For user-facing work verify the full business journey; for AI-native work verify system correctness and AI correctness. Classify each AC VERIFIED, PARTIAL, UNVERIFIED, or FAILED. Report blockers before optional improvements. Do not mark Done while required evidence is missing. End with the smallest next action required to reach verified Done.
```
