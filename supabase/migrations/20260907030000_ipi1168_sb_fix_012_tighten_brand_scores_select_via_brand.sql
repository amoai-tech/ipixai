-- IPI-1168 · SB-FIX-012 — tighten brand_scores_select_via_brand from PUBLIC
-- to authenticated.
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
