-- IPI-1163 · SB-SEC — revoke anon's excess table-level grants on the
-- demo-event tables and brand_scores, down to SELECT only.
--
-- Confirmed live on production via read-only information_schema query
-- (2026-09-07): `anon` holds SELECT, INSERT, UPDATE, DELETE, TRUNCATE,
-- REFERENCES, and TRIGGER on all 5 tables below. RLS already blocks the
-- write commands today (and will block them completely once this
-- migration's companion migrations -- 20260907020000's policy drops and
-- 20260907030000's brand_scores tightening -- land, leaving anon with
-- zero permissive policies for INSERT/UPDATE/DELETE on any of them). But
-- Supabase's own documented security model is two independent layers,
-- GRANT and RLS, and least-privilege means not leaving the GRANT layer
-- wide open just because RLS currently covers for it. This is pure
-- defense-in-depth: revoking these grants changes no currently-reachable
-- behavior (confirmed no anon policy permits INSERT/UPDATE/DELETE on any
-- of these 5 tables once the sibling migrations apply).
--
-- No-op on any environment built from this recovered chain that already
-- has narrower grants; safe wherever anon currently holds these.

revoke insert, update, delete, truncate, references, trigger
  on public.events, public.event_phases, public.event_schedules, public.ticket_tiers, public.brand_scores
  from anon;

-- ============================================================================
-- Emergency forward restoration — explicit human authorization required
-- (manual — run as a separate, reviewed forward migration if ever needed;
-- do NOT execute automatically or as part of any rollback tooling)
-- ----------------------------------------------------------------------------
-- grant insert, update, delete, truncate, references, trigger
--   on public.events, public.event_phases, public.event_schedules, public.ticket_tiers, public.brand_scores
--   to anon;
-- ============================================================================
