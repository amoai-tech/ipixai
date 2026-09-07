-- IPI-647 · PLN-SEC-002 — Enforce Planner Instance Assignment in Database Read Policies
--
-- Purpose:
--   Close the direct Data API gap where any org member could SELECT every
--   planner.instances / tasks / dependencies row with no planner.assignments row.
--
-- Approach:
--   Drop and recreate the three PERMISSIVE SELECT policies with a combined
--   predicate (org membership AND assignment). Do NOT add a second permissive
--   policy — PostgreSQL ORs permissive policies and would leave the org-only path.
--
-- Access model (locked):
--   - No org-admin bypass
--   - Revoked access = deleted assignment row (no revoked_at column)
--   - Reuses public.is_org_member + planner.is_at_least(..., 'viewer')
--
-- Out of scope: UI, authorized-read RPC, pgTAP, historical migration edits, new indexes.
--
-- Follow-on: 20260720032604_planner_is_at_least_volatile.sql — is_at_least must be
-- VOLATILE so INSERT...RETURNING can see bootstrap_owner_assignment side-effects.

-- ── instances ──────────────────────────────────────────────────────────────
drop policy if exists "instances_select_org" on planner.instances;

create policy "instances_select_org"
  on planner.instances
  for select
  to authenticated
  using (
    public.is_org_member(org_id)
    and planner.is_at_least(id, 'viewer')
  );

-- ── tasks ──────────────────────────────────────────────────────────────────
drop policy if exists "tasks_select_org" on planner.tasks;

create policy "tasks_select_org"
  on planner.tasks
  for select
  to authenticated
  using (
    exists (
      select 1
      from planner.instances i
      where i.id = tasks.instance_id
        and public.is_org_member(i.org_id)
    )
    and planner.is_at_least(instance_id, 'viewer')
  );

-- ── dependencies ───────────────────────────────────────────────────────────
drop policy if exists "dependencies_select_org" on planner.dependencies;

create policy "dependencies_select_org"
  on planner.dependencies
  for select
  to authenticated
  using (
    exists (
      select 1
      from planner.instances i
      where i.id = dependencies.instance_id
        and public.is_org_member(i.org_id)
    )
    and planner.is_at_least(instance_id, 'viewer')
  );
