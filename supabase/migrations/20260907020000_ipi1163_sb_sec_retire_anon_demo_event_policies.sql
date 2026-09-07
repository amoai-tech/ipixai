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
-- migration history. IF EXISTS / ALTER POLICY make it safe to run on any
-- environment regardless.
--
-- Deliberately NOT touched here (becomes permanently unreachable dead code
-- once this migration lands, since no path can create a new sentinel-
-- tagged event afterward -- same class as trigger_set_timestamps in
-- IPI-1162's Slice 4A, confirmed dead but not recreated/removed either):
--   - event_phases_insert's authenticated-side sentinel OR-branch
--     (20260730032752_consolidate_multiple_permissive_policies_event_phases.sql)
--   - events_select_anon's sentinel OR-branch
--     (20260730032949_consolidate_multiple_permissive_policies_events_anon.sql)
-- Both are already correctly recovered history (byte-identical to
-- production), not drift -- retiring them too is optional cleanup of dead
-- code, not required to close the write-access exposure, and is left for a
-- separate decision if wanted.
--
-- Requires explicit human authorization before production apply -- see the
-- IPI-1163 deployment plan. This file only lands the proposal in Git.

drop policy if exists "anon can insert demo events" on public.events;
drop policy if exists "anon can insert demo event phases" on public.event_phases;
drop policy if exists "anon can insert demo event schedules" on public.event_schedules;
drop policy if exists "anon can insert demo ticket tiers" on public.ticket_tiers;

alter policy "organizers can insert events" on public.events
  with check (auth.uid() = organizer_id);
