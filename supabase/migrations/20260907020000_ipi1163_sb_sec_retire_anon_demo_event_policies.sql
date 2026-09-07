-- IPI-1163 · SB-SEC — retire the legacy anon demo-event write policies.
--
-- Investigated during IPI-1162 · SB-MIG-003's fresh-replay diff and
-- decided PROPOSED (not yet authorized) per IPI-1163: a sentinel
-- organizer_id ('00000000-0000-0000-0000-000000000000') lets the `anon`
-- role write demo events/phases/schedules/ticket-tiers in production, plus
-- an `authenticated`-side escape hatch with the same sentinel on
-- "organizers can insert events". Evidence this is dead in current iPix V2
-- (see supabase/docs/audit/ipi-1162-migration-recovery.md "Slice 4B"):
--   - zero references to events/event_phases/event_schedules/ticket_tiers
--     anywhere in src/ (routes, actions, components, tests)
--   - zero mentions of an "events" product concept in prd.md/docs/prd.md
--   - zero rows in production have ever used the sentinel (checked
--     read-only 2026-09-07: 0 sentinel events out of 14 total, all legacy)
--
-- This migration is a NO-OP on any environment built from this recovered
-- chain (IPI-1162's Case B decision already excluded these 4 anon INSERT
-- policies from the recovered history, and the "organizers can insert
-- events" policy was recovered in its already-narrow, no-sentinel form —
-- see 20250125000002_create_events_core.sql). It only has an effect against
-- PRODUCTION, where these policies are live but were never captured in
-- migration history.
--
-- The 4 DROP POLICY IF EXISTS statements are unconditionally safe. The
-- ALTER POLICY statement below is NOT self-guarding — Postgres has no
-- ALTER POLICY IF EXISTS — so it requires "organizers can insert events"
-- to already exist. That precondition holds on every environment built
-- from this recovered chain: the policy is created by the very first
-- historical migration (20250125000002_create_events_core.sql) and is
-- never dropped or renamed by any later migration (confirmed by grep
-- across supabase/migrations/ for its exact name) — unlike, e.g.,
-- event_phases_insert, which WAS consolidated under a new name.
--
-- event_phases_insert's authenticated-side sentinel OR-branch
-- (20260730032752_consolidate_multiple_permissive_policies_event_phases.sql)
-- IS also narrowed below, even though it's already unreachable once the 4
-- DROPs above land (nothing can create a new sentinel-tagged event
-- afterward): it's a write-authorization bypass, and defense-in-depth says
-- a dormant write bypass shouldn't be left sitting in the policy even when
-- currently unreachable, unlike a read-only one.
--
-- events_select_anon's sentinel OR-branch
-- (20260730032949_consolidate_multiple_permissive_policies_events_anon.sql)
-- is left alone: read-only, harmless dead code once nothing can create a
-- sentinel-tagged row, and already correctly recovered history (byte-
-- identical to production, not drift) -- optional cleanup, not required.
--
-- Requires explicit human authorization before production apply -- see the
-- IPI-1163 deployment plan. This file only lands the proposal in Git.

drop policy if exists "anon can insert demo events" on public.events;
drop policy if exists "anon can insert demo event phases" on public.event_phases;
drop policy if exists "anon can insert demo event schedules" on public.event_schedules;
drop policy if exists "anon can insert demo ticket tiers" on public.ticket_tiers;

alter policy "organizers can insert events" on public.events
  with check ((select auth.uid()) = organizer_id);

alter policy "event_phases_insert" on public.event_phases
  with check (
    exists (
      select 1 from events
      where events.id = event_phases.event_id
        and events.organizer_id = auth.uid()
    )
  );
