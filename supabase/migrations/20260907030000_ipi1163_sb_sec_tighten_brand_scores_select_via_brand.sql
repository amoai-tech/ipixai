-- IPI-1163 · SB-SEC — tighten brand_scores_select_via_brand from PUBLIC
-- to authenticated. (Originally filed as a separate ticket, IPI-1168 ·
-- SB-FIX-012, before being found to duplicate IPI-1163's own scope and
-- consolidated there -- see IPI-1168's cancellation comment. Renamed from
-- this file's original ipi1168 filename to reflect single ownership;
-- unapplied, so renaming now is safe.)
--
-- Confirmed live on production via read-only pg_policy query (2026-09-07):
-- polroles = '{-}' (PUBLIC, i.e. every role including anon), using
-- `is_org_member(b.org_id)`. Functionally dead for anon today --
-- is_org_member() checks org_members for auth.uid(), which is always NULL
-- for the anon role, so this can never actually return a row to an
-- unauthenticated caller. But PUBLIC scoping is not least-privilege, and
-- the recovered/local historical file already has the correct
-- authenticated-only scoping (never wrong; only production's live grant
-- had drifted -- same class of divergence as block_brand_org_change,
-- IPI-1167). No historical migration is edited.
--
-- No-op on any environment built from this recovered chain.

alter policy brand_scores_select_via_brand on public.brand_scores
  to authenticated;

-- ============================================================================
-- Emergency forward restoration — explicit human authorization required
-- (manual — run as a separate, reviewed forward migration if ever needed;
-- do NOT execute automatically or as part of any rollback tooling)
-- ----------------------------------------------------------------------------
-- alter policy brand_scores_select_via_brand on public.brand_scores
--   to public;
-- ============================================================================
