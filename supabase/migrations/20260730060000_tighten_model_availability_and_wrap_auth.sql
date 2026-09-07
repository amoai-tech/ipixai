-- Tighten model_availability reads + wrap auth.uid() in the remaining policies
-- from the 2026-07-30 consolidation batch.
--
-- Forward-only. Does NOT edit the applied migrations.
-- Raised in review of PR #674 (inline comments on 20260730032611 and 20260730032731).
--
-- Every expression below was copied from live pg_policies output and changed ONLY
-- where noted, so the rewrites are semantically identical apart from the one
-- deliberate narrowing in section 1.

-- ---------------------------------------------------------------------------
-- 1. model_availability_select — remove the blanket (event_id IS NULL) branch
--
-- Current live USING:
--   (model_profile owned by me) OR (event_id IS NULL) OR (event organized by me)
--
-- The middle branch has no ownership or tenant predicate, so ANY authenticated
-- user could read EVERY row with a null event_id. Per the table's own comment,
-- "event_id is null for blocks, set for bookings" — i.e. that branch exposed
-- exactly the personal-calendar rows.
--
-- Safe to narrow: no application code reads this table. Verified —
--   grep -rn 'model_availability' app/src src --include=*.ts --include=*.tsx
--   -> only app/src/types/supabase.ts (generated types)
-- so there is no casting conflict-detection consumer to break.
--
-- Ownership condition preserved; event branch now requires event_id IS NOT NULL
-- AND an organizer match, as specified in review.
--
-- NOTE: the same unrestricted branch is still present on this table's
-- INSERT / UPDATE / DELETE policies, so an authenticated user can likely still
-- WRITE blocks. Deliberately out of scope here to keep this migration minimal —
-- tracked by IPI-868 (SB-SEC-008) along with the designer_availability and
-- venue_availability siblings from the same source migration.
-- ---------------------------------------------------------------------------

alter policy model_availability_select on public.model_availability
  using (
    exists (
      select 1
      from public.model_profiles
      where model_profiles.id = model_availability.model_profile_id
        and model_profiles.profile_id = (select auth.uid())
    )
    or (
      model_availability.event_id is not null
      and exists (
        select 1
        from public.events
        where events.id = model_availability.event_id
          and events.organizer_id = (select auth.uid())
      )
    )
  );

-- ---------------------------------------------------------------------------
-- 2. Wrap auth.uid() as (select auth.uid()) — auth_rls_initplan / lint 0003
--
-- Expression logic unchanged in all five. Only the auth.uid() call sites are
-- wrapped so Postgres evaluates them once per statement as an InitPlan instead
-- of once per row.
-- ---------------------------------------------------------------------------

alter policy events_select on public.events
  using (
    ((status = 'published'::public.event_status) and (is_public = true))
    or ((select auth.uid()) = organizer_id)
  );

alter policy ticket_tiers_select on public.ticket_tiers
  using (
    exists (
      select 1 from public.events
      where events.id = ticket_tiers.event_id
        and events.status = 'published'::public.event_status
        and events.is_public = true
    )
    or exists (
      select 1 from public.events
      where events.id = ticket_tiers.event_id
        and events.organizer_id = (select auth.uid())
    )
  );

alter policy event_designers_select on public.event_designers
  using (
    exists (
      select 1 from public.events
      where events.id = event_designers.event_id
        and events.status = 'published'::public.event_status
        and events.is_public = true
    )
    or exists (
      select 1 from public.events
      where events.id = event_designers.event_id
        and events.organizer_id = (select auth.uid())
    )
  );

alter policy call_times_select on public.call_times
  using (
    (
      call_times.model_profile_id is not null
      and exists (
        select 1 from public.model_profiles
        where model_profiles.id = call_times.model_profile_id
          and model_profiles.profile_id = (select auth.uid())
      )
    )
    or exists (
      select 1 from public.events
      where events.id = call_times.event_id
        and events.organizer_id = (select auth.uid())
    )
    or (
      call_times.stakeholder_id is not null
      and exists (
        select 1 from public.stakeholders
        where stakeholders.id = call_times.stakeholder_id
          and stakeholders.profile_id = (select auth.uid())
      )
    )
  );

-- INSERT policy: WITH CHECK only, no USING clause.
-- The second branch compares against the all-zeros uuid — a demo/seed sentinel
-- carried over from the original policy. Preserved verbatim rather than
-- "cleaned up", since changing it would alter who can insert.
alter policy event_phases_insert on public.event_phases
  with check (
    exists (
      select 1 from public.events
      where events.id = event_phases.event_id
        and events.organizer_id = (select auth.uid())
    )
    or exists (
      select 1 from public.events
      where events.id = event_phases.event_id
        and events.organizer_id = '00000000-0000-0000-0000-000000000000'::uuid
    )
  );
