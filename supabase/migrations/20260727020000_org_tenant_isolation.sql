-- IPI-809 · SEC-ONB-001 — restore organization tenant isolation
--
-- public.organizations has two PERMISSIVE SELECT policies. Postgres ORs permissive policies
-- together, so `USING (true)` always wins and the correct member-scoped policy is dead code:
-- any authenticated account can read every organization row.
--
-- Dropping the permissive policy is the fix. But dropping it ALONE breaks onboarding, and that
-- is not a prediction — it was proven against the live database on 2026-07-27 inside a
-- rolled-back transaction, three runs with identical statements:
--
--   A  policy present (control)           -> INSERT ... RETURNING id   returns the row
--   B  USING (true) dropped, nothing else -> ERROR 42501: new row violates row-level security
--   C  dropped + orgs_select_owner added  -> INSERT ... RETURNING id   returns the row
--
-- Cause: insertOrganization (app/src/lib/onboarding.ts:40) does .insert().select("id"), i.e.
-- INSERT ... RETURNING. RETURNING is projected against the SELECT policy BEFORE the AFTER
-- INSERT trigger organizations_auto_add_owner has created the org_members row, so
-- is_org_member(id) is false at that instant and the new row is invisible to its own inserter.
--
-- orgs_select_owner closes that window. It does not depend on membership timing, only on
-- owner_id, which is set in the INSERT itself. It also completes a set the table already has:
-- orgs_insert_owner and orgs_delete_owner are both owner-scoped; SELECT was the only one that
-- was not.
--
-- ADMIN SELECT DECISION (IPI-809, recorded 2026-07-27): member-scoped, no admin SELECT policy.
-- organizations carries admins_can_insert / update / delete_organizations but has never had an
-- admin SELECT policy — global admin read came only from the permissive `true` policy being
-- dropped here. Verified before deciding: no screen, route or query in app/src reads all
-- organizations. The only four readers are onboarding's insert and delete, plus two embedded
-- joins (api/org/current/route.ts:23 and brand/[id]/page.tsx:49), all of which are inherently
-- scoped to the caller's own org. Admins therefore see the organizations they are members of.
-- If a genuine admin surface appears later, add an admin-scoped SELECT policy mirroring
-- admins_can_update_organizations. Never restore USING (true).
--
-- Reversible; see the rollback note at the foot of this file.

drop policy if exists "authenticated can view organizations" on public.organizations;

-- Owner-scoped SELECT. `(select auth.uid())` rather than a bare call so the planner runs it as
-- an initPlan once per statement instead of once per row — Supabase's documented RLS
-- performance guidance.
create policy "orgs_select_owner"
  on public.organizations for select to authenticated
  using ((select auth.uid()) = owner_id);

-- Rollback (do not run casually — it restores the tenant leak):
--   drop policy if exists "orgs_select_owner" on public.organizations;
--   create policy "authenticated can view organizations"
--     on public.organizations for select to authenticated using (true);
