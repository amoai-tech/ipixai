-- IPI-1089 · ONBOARD-001 — enforce at most one materialized onboarding per user.
--
-- The onboarding idempotency key lives in localStorage, so cleared browser
-- storage mints a new key and the user could materialize a second org + brand.
-- materialize_onboarding_session is keyed by (user_id, idempotency_key) and must
-- stay unchanged (issue contract), so the invariant is enforced at the schema
-- level: a partial unique index on materialized sessions.

-- IPI-1162 · SB-MIG-003 fresh-replay adaptation: LOCK TABLE requires an
-- explicit transaction block (Postgres rejects it as a standalone
-- autocommitted statement) — added BEGIN/COMMIT around the unchanged
-- original statements below; this is a mechanical execution-environment fix,
-- not a content or behavior change. This latent issue never surfaced before
-- because it was first applied to production incrementally (one file per
-- deploy, under whatever tool wrapped it at the time), not via a from-scratch
-- replay of the full chain.
BEGIN;

-- Serialize concurrent materialization: SHARE ROW EXCLUSIVE blocks writers
-- (including the RPC's inserts) while allowing reads, so a concurrent RPC cannot
-- insert a duplicate between the cleanup and the index scan.
lock table public.onboarding_sessions in share row exclusive mode;

-- Reclassify pre-existing duplicate materialized sessions (keep the newest,
-- deterministic created_at desc, id desc tie-breaker) to an archival
-- 'superseded' status instead of deleting them: the row keeps its
-- organization_id/brand_id provenance for later tenancy repair, and the partial
-- unique index only sees the one remaining materialized row. The orgs/brands
-- themselves are intentionally left untouched — deleting them could cascade to
-- dependent data (shoots, assets).
alter table public.onboarding_sessions
  drop constraint onboarding_sessions_status_check,
  add constraint onboarding_sessions_status_check
    check (status in ('draft', 'materialized', 'superseded'));

update public.onboarding_sessions s
set status = 'superseded'
from (
  select id,
         row_number() over (
           partition by user_id
           order by created_at desc, id desc
         ) as rn
  from public.onboarding_sessions
  where status = 'materialized'
) ranked
where s.id = ranked.id
  and ranked.rn > 1;

-- A second materialization for the same user violates this index and rolls back
-- the whole RPC transaction (org + brand inserts included) — fail closed.
create unique index onboarding_sessions_one_materialized_per_user
  on public.onboarding_sessions (user_id)
  where status = 'materialized';

-- A user must not be able to delete a materialized session and re-materialize
-- under a fresh key (that would mint a second org + brand). Deletion is only
-- allowed for draft sessions.
drop policy if exists onboarding_sessions_delete_own on public.onboarding_sessions;
create policy onboarding_sessions_delete_own on public.onboarding_sessions
  for delete to authenticated
  using (auth.uid() = user_id and status = 'draft');

COMMIT;