-- IPI-809 · SEC-ONB-001 PR 2 — revoke PUBLIC/anon EXECUTE on org helpers + trigger funcs
--
-- PR 1 (20260727020000) locked organizations SELECT to membership.
-- PR 2 recalls default PUBLIC/anon EXECUTE on the eight helpers/triggers that
-- still hand out the keys: membership oracles + trigger-only RPCs.
--
-- RLS helpers: authenticated (+ service_role) MUST keep EXECUTE — ~118 policies
-- call is_org_member / is_org_owner / is_org_editor_or_above.
-- Trigger-only: no client role needs direct EXECUTE; PostgreSQL still fires
-- triggers without client EXECUTE on the function.
--
-- Pattern (IPI-544): REVOKE ALL from every role that might hold grants, then
-- GRANT EXECUTE only to the intended roles — leaves no leftover ACL ambiguity.

BEGIN;

-- Membership helpers used by RLS — wipe then re-grant signed-in + service only.
REVOKE ALL ON FUNCTION public.is_org_member(uuid) FROM public, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.is_org_owner(uuid) FROM public, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.is_org_editor_or_above(uuid) FROM public, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.is_org_member(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_org_owner(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_org_editor_or_above(uuid) TO authenticated, service_role;

-- Trigger-only — wipe all client + service grants, then EXECUTE for service_role only.
REVOKE ALL ON FUNCTION public.auto_add_org_owner() FROM public, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM public, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.block_brand_org_change() FROM public, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.check_campaign_org_consistency() FROM public, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.create_default_event_phases() FROM public, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.auto_add_org_owner() TO service_role;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;
GRANT EXECUTE ON FUNCTION public.block_brand_org_change() TO service_role;
GRANT EXECUTE ON FUNCTION public.check_campaign_org_consistency() TO service_role;
GRANT EXECUTE ON FUNCTION public.create_default_event_phases() TO service_role;

COMMIT;
