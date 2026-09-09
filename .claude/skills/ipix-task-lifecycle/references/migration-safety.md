# Migration safety (iPix / Supabase remote)

Use during Phase 2 research and Phase 3 implementation before any schema change.

**Also load:** [supabase/README.md](../../../../supabase/README.md) · [ipix-supabase/supabase](../../ipix-supabase/SKILL.md) · [ipix-supabase/postgres](../../ipix-supabase/SKILL.md)

---

## Workflow (declarative schema)

1. Edit `.sql` in `supabase/schemas/` (not hand-edit `migrations/` unless caveats).
2. `supabase stop` if local stack running (MVP uses **remote linked** only).
3. `supabase db diff -f <descriptive_name>` — review generated migration.
4. Apply via linked project per README (`db push --linked` or documented repair flow).
5. `npm run supabase:verify` + `npm run supabase:verify-rls`.
6. Regenerate types: `npm run supabase:types` if `src/types/supabase.ts` consumers changed.

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
