# 19 — Migrations + legacy

Status: Complete
Score: 62/100
Verification confidence: 90/100
Tables inspected: `supabase_migrations.schema_migrations` 309; `public.supabase_migrations` 0
Code paths inspected: `supabase/migrations/` in ipixai (**1 file**)
Live queries: `list_migrations` (truncated in tool but count 309 from table)
Official references: [Supabase migrations](https://supabase.com/docs/guides/deployment/database-migrations)

## Verdict

**Live history is the SSOT** (309 versions, FashionOS → iPix). **This repo is not** a clone of that history. One unapplied file: `20260825095051_ipi897_revoke_planner_default_privileges.sql`. Do **not** repair, squash, or `db push` from ipixai Core work. Classify below; **no destructive cleanup**.

## Current state

| Class | Examples |
| --- | --- |
| Canonical | `planner.*`, `shoot.*`, `talent.*`, `mastra.*`, `organizations` / `org_members`, `brands`, `assets` |
| Active legacy | `public.shoots` (8), FashionOS `events` / `event_phases` (170), `model_profiles` (3) |
| Compatibility | fail-closed chatbot; `media_size_specs` frozen |
| Migration source | live 309; old operator repo historically; ipixai 1 forward file |
| Future retirement | public.shoots, FashionOS empty trees, IPI-949 empty orgs |
| Unknown | `public.supabase_migrations` empty twin |

Last remote names seen include `ipi_v2_000_sb_fix_*` (Aug 24) and IPI-1008 mastra workflow definitions. IPI-897 **not** in that list.

## What is correct

- Forward-only policy (**IPI-1040**).
- pg_graphql dropped in history.

## Errors / red flags

| Pri | Finding |
| --- | --- |
| P1 | Agents that `migration new` against a 1-file folder will **diverge** further |
| P2 | Duplicate generation of FashionOS + iPix (events vs planner) |

## Fixes

- Runbook: **IPI-1040**. Apply 897 only when approved.
- Never `migration repair` in this audit.

## Faster/better approach

Count remote vs `ls supabase/migrations`.

## Production blockers

Process: **cannot recreate this DB from ipixai migrations**.

## Existing Linear ownership

**IPI-1040 · SB-V2-004**, **IPI-897**.

## Verification / success criteria

- [x] 309 vs 1
- [ ] Full version diff file-by-file — **not done** (too large; use 1040)

## ERD / data flow where useful

```text
Old iPix repo migrations → live 309
ipixai/supabase/migrations → 1 pending (897)
```

## Next step

**20 — Production readiness**
