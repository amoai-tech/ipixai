# Testing matrix

Used by the deprecated lifecycle compatibility flow. Canonical risk-matched verification lives in [tasks pre-merge tests](../../tasks/references/pre-merge-tests.md); this matrix is a convenience summary only and must not override it.

---

## Per-task summary

| Task delivers | Typical cheapest proof |
|---------------|------------------------|
| Hook, service, util | targeted Vitest |
| React component | Vitest/RTL when logic exists; browser when behavior is user-visible |
| API route / server action | handler/integration test |
| Page / panel | targeted logic test + browser journey when required |
| Edge function | invoke smoke + edge verification when edge behavior changed |
| Migration | targeted SQL/RLS proof + fresh replay when migration-chain risk exists |
| Docs only | documentation review; no unrelated runtime gate |

Do not advance until the current task's required proof passes.

---

## Aggregate matrix

| Change shape | Vitest | Browser | Supabase/RLS/edge | Notes |
|--------------|--------|---------|-------------------|-------|
| Presentational React | if logic | when visible interaction/layout matters | — | cheapest proof first |
| Data-fetching React | yes | usually | only if DB/auth boundary changed | hook/query tests |
| Hook/service | yes | — | only if boundary changed | targeted |
| Page/route | yes | when observable route/auth behavior matters | only if boundary changed | auth redirect where relevant |
| Auth/session | targeted auth | yes | RLS only when DB boundary changed | include negative path |
| Edge function | yes | as needed | edge verification required | schema/JWT/provider behavior |
| Migration/RLS/RPC | as relevant | only if user journey depends on it | required targeted SQL; fresh replay when history matters | use ipix-supabase |
| AI prompt/schema | deterministic/eval proof | real journey when user-facing | — unless persistence/auth touched | no fake forced-tool proof |
| Pure refactor | rerun affected | — | — | no new gates |
| Docs only | — | — | — | no runtime checks unless docs change executable behavior |

Legend: every gate is conditional on the changed boundary. Do **not** run Supabase verification for docs-only or UI-only work that does not touch Supabase contracts.

---

## Canonical gate

Use `.claude/skills/tasks/references/pre-merge-tests.md` to choose the actual command set. Re-read current `package.json` and CI before naming commands; do not maintain a second fixed command list here.

---

## Specialist routing

| Need | Skill |
|------|-------|
| Canonical pre-merge matrix | [tasks](../../tasks/references/pre-merge-tests.md) |
| Vitest / RTL patterns | [gen-test](../../gen-test/SKILL.md) |
| Forensic Done gate | [task-verifier](../../task-verifier/SKILL.md) |
| Supabase/RLS/edge HOW | [ipix-supabase](../../ipix-supabase/SKILL.md) |

Workflow detail: [../testing.md](../testing.md).
