# Migration safety (iPix / Supabase remote)

Use during Phase 2 research and Phase 3 implementation before any schema change.

**Also load:** [supabase/README.md](../../../../supabase/README.md) · [ipix-supabase/supabase](../../ipix-supabase/SKILL.md) · [ipix-supabase/postgres](../../ipix-supabase/SKILL.md)

---

## Workflow — verified production path (IPI-1171)

1. Create/review the version-controlled migration under `supabase/migrations/`.
2. Run targeted SQL/security tests, then prove a fresh local replay with `supabase db reset --local`.
3. Open a PR and require both `Supabase Preview` and `supabase-fresh-replay` to pass.
4. Obtain explicit human approval for the migration-bearing PR.
5. Merge to protected `main`; the enabled Supabase GitHub Integration owns production migration application.
6. Do **not** run a second manual `supabase db push --linked` after merge. Verify the live migration ledger and changed objects read-only instead.
7. Regenerate types when exposed schemas changed.

Use `supabase migration repair` or other linked mutation only in an explicit reviewed recovery/incident procedure.

---

## Pre-migration checklist

```
[ ] Rollback SQL drafted (comment block at top of migration file)
[ ] RLS policies in same migration as table (enable RLS + policies)
[ ] `(select auth.uid())` in policies — not bare auth.uid()
[ ] Indexes on FK columns and common filter columns
[ ] ON DELETE behavior explicit (CASCADE / SET NULL / RESTRICT)
[ ] No breaking rename without coordinated app change in same PR
[ ] Service role bypass documented if required (edge functions only)
[ ] No secrets in migration files
[ ] live Linear blocked-by/dependency order respected — blocked issues not migrated early
```

---

## RLS checklist

```
[ ] RLS enabled on new tables
[ ] SELECT/INSERT/UPDATE/DELETE policies for operator scope
[ ] Cross-tenant read test planned (verify-rls script)
[ ] Policies use auth.uid() subquery form for perf
[ ] No policy references client-writable columns unsafely
```

---

## Post-migration verify

```bash
cd /home/sk/ipix
npm run supabase:verify
npm run supabase:verify-rls
npm run build   # types + hooks compile
```

Use Supabase MCP `get_advisors` for security/performance hints after apply.

---

## Rollback

- Prefer forward-fix for additive migrations (new nullable column).
- Destructive change: run rollback SQL from migration header; `supabase migration repair` if orphan per README.
- Never edit applied migration file in place — new migration for fixes.

---

## Anti-patterns

| Don't | Do |
|-------|-----|
| `supabase start` as MVP default | Linked remote project |
| RLS as follow-up PR | Same migration as table |
| Client service role | Edge function + user JWT |
| Manual prod SQL without migration file | Declarative diff + version control |
