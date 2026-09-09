# Phase 3 — Implementation

Coordinator for coding from the current repository root / active worktree. Routes trivial edits directly; non-trivial work through
[feature-dev](../archive/feature-dev/SKILL.md). **Per-task testing:** [references/per-task-testing.md](references/per-task-testing.md).

---

## Entry / exit criteria

| | Criterion |
|---|---|
| **Entry** | Live Linear issue satisfies the `tasks` format gate · required skills/context identified · Linear **In Progress**. Phase 2 = green-light or trivial-skip. [Step 1b](#step-1b--mandatory-pre-edit-gate) complete before first edit. |
| **Exit** | All planned leaf checkpoints implemented and verified. Relevant targeted tests pass; `npm run typecheck` runs when TypeScript surface risk warrants it; build/browser proof runs only when the risk requires it. Ready for [testing.md](testing.md). |

---

## Workflow checklist

```
[ ] 1.  Complete [Step 1b](#step-1b--mandatory-pre-edit-gate) — mandatory before any edit.
[ ] 2.  Set Linear In Progress (Linear MCP or agreed fallback).
[ ] 3.  Read the live Linear task, `tasks` skill references for this phase, and only current repo plans/docs that actually exist.
[ ] 4.  Read-before-edit: every file in plan + 1–2 siblings for pattern.
[ ] 5.  Trivial vs non-trivial (table below).
[ ] 6.  For EACH A–E step in plan (in order):
        a. Write failing test (or document smoke pre-check)
        b. Run step proof command — confirm FAIL (or smoke baseline)
        c. Implement minimal change for this step only
        d. Run step proof command — confirm PASS
        e. run the smallest relevant type/test proof; use `npm run typecheck` when TypeScript surface risk warrants it
        f. Do NOT start next step until (d) passes
[ ] 7.  Implement order: migration → edge fn → lib/hooks → UI (when cross-layer).
[ ] 8.  Run the risk-matched pre-merge subset; root has `npm run typecheck` and no root lint script.
[ ] 9.  Self-review git diff — each hunk maps to an AC + test file.
[ ] 10. Hand off to testing.md for aggregate matrix.
```

---

## Step 1b — Mandatory pre-edit gate

Before editing code, the agent must complete this gate. **Fail closed** — stop and report on any stop condition.

### 1. Skill gate

- Re-read every skill listed in the live Linear issue `**Skills:**` line.
- `Read` each `.claude/skills/<slug>/SKILL.md` — copy only relevant MUST / Do NOT rules into implementation notes.
- If the `**Skills:**` line is missing, **stop** and return to [planning.md](planning.md) Phase 1.

### 2. Worktree gate

- New worktree: `npm run worktree:audit` then `npm run worktree:add -- IPI-NNN slug`.
- Existing worktree: `npm run worktree:health` (also run `worktree:audit` if inventory is stale or count is high).
- Confirm `git branch --show-current` matches `ipi/<id>-*` for this IPI.
- Confirm no unrelated dirty files (`git status --short` — know what is yours).
- **Never edit from the main checkout** — use a worktree branch.

### 3. Existing-code gate

- Before any `Read`, `Grep`, `Glob`, or exploratory `Bash`, run `PATH="$HOME/.local/bin:$PATH" graphify query "<task question>"` when `graphify-out/graph.json` exists; use the scoped graph to choose the smallest file set.
- Inspect the current code path before creating new files.
- Reuse existing components, routes, schemas, and helpers where possible.
- Do not duplicate logic already covered by shared primitives.

### 4. Step gate

- Implement only **one A–E step** at a time.
- Run that step's `proof:` command before moving to the next step.
- If proof fails, stop and fix before continuing.

### 5. Stop conditions

Stop and report the blocker if:

- required `**Skills:**` line or skill rules are missing
- worktree is unsafe (`worktree:health` / `worktree:audit` fails)
- current branch does not match the IPI
- unrelated dirty files exist and are not understood
- proof command fails
- implementation requires scope outside the issue

Full worktree detail: [worktrees](../worktrees/SKILL.md) · domain skills: [domain-skill-routing.md](references/domain-skill-routing.md)

---

## Per-task test loop

```
Task N: implement → run Test command → PASS? → Task N+1
                              ↓ FAIL
                         fix code or test (stay on Task N)
```

Load [gen-test](../gen-test/SKILL.md) when authoring Vitest. Full contract:
[per-task-testing.md](references/per-task-testing.md).

---

## Read-before-edit rule

**Mandatory.**

- Run Graphify first as described in Step 1b, then read all wiring-plan paths before first edit.
- Grep callers for hooks/services you touch only after the Graphify pass.
- Migrations: read latest in `supabase/migrations/` after the Graphify pass.
- Edge: [ipix-supabase](../ipix-supabase/SKILL.md) + [gemini](../gemini/SKILL.md) if AI.
- RLS: [ipix-supabase](../ipix-supabase/SKILL.md) patterns.

---

## Trivial vs non-trivial

| Trivial — edit directly | Non-trivial — [feature-dev](../archive/feature-dev/SKILL.md) + [writing-plans](../writing-plans/SKILL.md) |
|-------------------------|--------------------------------------------------------|
| ≤5 file edits | >5 files or cross-layer |
| Single area (`src/app/` only) | UI + service + migration |
| No migration / RLS | Any schema or RLS change |
| No new abstractions | Pattern others will copy |
| Clear AC + wiring + test | Ambiguous integration |

Even trivial edits need at least one test run or documented smoke in the task proof.

---

## Code quality (reminders)

- Canonical Next.js App Router surface: `src/app/`.
- `@/` imports resolve from the current root source tree; verify `tsconfig` before assuming aliases.
- `cn()` for conditional Tailwind.
- Four states on data UI components.
- RLS: `(select auth.uid())` subquery pattern.
- No client `SERVICE_ROLE` / `GEMINI_API_KEY`.

Full rules: [CLAUDE.md](../../../CLAUDE.md) · `.cursor/rules/`.

---

## Migration safety

[references/migration-safety.md](references/migration-safety.md) · after migration task:
`infisical run -- npm run supabase:verify-rls`.

---

## Validation per task

| After each task | Pass |
|-----------------|------|
| Task `Test` command (Vitest/smoke/verify) | Exit 0 / expected output |
| targeted test/proof + `npm run typecheck` when applicable | Exit 0 / expected result |

## Validation before Phase 4

| Command | Pass |
|---------|------|
| `npm run typecheck` | Exit 0 when TypeScript surface changed |
| `npm test` / targeted Vitest | Required risk-matched tests pass |
| All task Test commands | Passed (logged in plan or Linear proof) |
| `git diff` review | Each hunk → AC + test |

---

## Anti-patterns

| Don't | Do |
|-------|-----|
| Defer all tests to Phase 4 | Test after every plan task |
| `it.skip` without follow-up issue | Fix or file IPI follow-up |
| Edit before reading | Graphify first, then read wiring-plan files |
| Scope creep | One issue = one shippable unit |
| `supabase start` | Remote linked project only |

---

## Routing

| Need | Route to |
|------|----------|
| Per-task contract | [references/per-task-testing.md](references/per-task-testing.md) |
| Vitest patterns | [gen-test](../gen-test/SKILL.md) |
| Multi-file / architecture | [feature-dev](../archive/feature-dev/SKILL.md) |
| Supabase / edge | [ipix-supabase](../ipix-supabase/SKILL.md) + [gemini](../gemini/SKILL.md) if AI |
| Domain skill pick list | [domain-skill-routing.md](references/domain-skill-routing.md) |
| Migration checklist | [references/migration-safety.md](references/migration-safety.md) |

Hand off to [testing.md](testing.md) when all per-task tests pass.
