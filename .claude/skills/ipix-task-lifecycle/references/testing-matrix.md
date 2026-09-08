# Testing matrix

Used in Phase 4 ([testing.md](../testing.md)) for aggregate gates. Per-task testing in Phase 3:
[per-task-testing.md](per-task-testing.md).

---

## Per-task (Phase 3) — required for every plan task

| Task delivers | Per-task Test block |
|---------------|---------------------|
| Hook, service, util | `npx vitest run <file> -t "<behaviour>"` |
| React component | Vitest + RTL — behaviour assertions |
| API route / server action | Vitest on handler or integration test |
| Page / panel | Vitest if logic + smoke note for four states |
| Edge function | invoke smoke + `npm run supabase:verify-edge` |
| Migration | `infisical run -- npm run supabase:verify-rls` |
| Docs only | lint — document skip |

Do not advance to the next plan task until the current task's Test command passes.

---

## Aggregate matrix (Phase 4)

| Change shape | Vitest | Browser smoke | supabase:verify | verify-rls | verify-edge | Notes |
|--------------|--------|---------------|-----------------|------------|-------------|-------|
| New React component (presentational) | smoke in task | yes | — | — | — | RTL if logic |
| New React component (data-fetching) | yes | yes | — | — | — | Hook + query tests |
| New custom hook | yes | — | — | — | — | `renderHook` |
| New page / route | yes | yes | — | — | — | Auth redirect smoke |
| Auth / session change | — | yes | — | yes | — | `/login` → `/dashboard` |
| New edge function | yes | — | yes | — | yes | Zod input + JWT |
| Edge function refactor | re-run | — | yes | — | yes | No behavior change |
| Migration (new table) | — | — | yes | yes | — | [migration-safety.md](migration-safety.md) |
| Migration (alter table) | re-run | optional | yes | yes | — | Types regen if needed |
| AI prompt / schema change | optional | yes | — | — | yes | Manual eval ≥5 cases |
| Pure refactor | re-run existing | — | — | — | — | No new gates |
| Docs only | — | — | — | — | — | Lint optional |

Legend: **yes** = required · **optional** = if AC names it · **—** = N/A · **re-run** = existing suite must pass.

---

## Required gates (every task)

Phase 3 (per task): task `Test` command from plan.

Phase 4 aggregate verification runs from the current iPixai repository root:

```bash
npm test                             # when broader Vitest coverage is justified
npm run typecheck
npm run build                        # when route/config/runtime risk requires it
infisical run -- npm run supabase:verify
infisical run -- npm run supabase:verify-rls
npm run supabase:verify-edge
```

Browser smoke for UI/auth per [testing.md](../testing.md).

---

## Tools

| Tool | Use for | Config |
|------|---------|--------|
| Vitest + RTL | Unit, component, hook | `vitest.config.ts` |
| `@testing-library/user-event` | Interactions | prefer over `fireEvent` |
| Dev server | Manual smoke | `npm run dev` → `:8080` |
| Supabase verify scripts | REST, RLS, edge | `package.json` scripts |
| Supabase MCP | Advisors, table list | `@supabase` MCP |
| Playwright | E2E (future) | add when critical paths exist |

---

## When to skip (document in spec)

| Skip | Justification example |
|------|------------------------|
| Vitest for layout-only tweak | "Visual only; smoke at `/route` covers regression." |
| verify-edge for doc-only edge comment | "No runtime change." |
| RLS verify for docs-only policy comment | "Policy text unchanged; no migration." |

Every skip needs a one-line note in the issue spec **Verify** section.

---

## Specialist routing

| Need | Skill |
|------|-------|
| Vitest / RTL patterns | [gen-test](../../gen-test/SKILL.md) |
| Forensic Done gate | [task-verifier](../../task-verifier/SKILL.md) |
| Edge smoke details | [ipix-supabase/edge-functions](../../ipix-supabase/SKILL.md) |
| RLS patterns | [ipix-supabase/postgres](../../ipix-supabase/SKILL.md) |

Workflow detail: [../testing.md](../testing.md).
