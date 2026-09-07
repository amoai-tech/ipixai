-- IPI-679 · SB-SEC-001 — revoke residual anon/authenticated EXECUTE on
-- SECURITY DEFINER RPCs that should be service_role-only.
--
-- Live signatures (2026-07-18 MCP re-probe):
--   search_context_snapshots(uuid, vector, text, integer)
--   traverse_brand_graph(uuid, integer, text[])
--   identify_rls_policies_needing_optimization()
--
-- Original migrations granted service_role only; anon/authenticated (and
-- PUBLIC on identify_rls_*) drifted back via default privileges. No app/
-- production callers. Keep service_role; harden fixed search_path.

revoke execute
on function public.search_context_snapshots(uuid, vector, text, integer)
from public, anon, authenticated;

grant execute
on function public.search_context_snapshots(uuid, vector, text, integer)
to service_role;

alter function public.search_context_snapshots(uuid, vector, text, integer)
  set search_path = public;

revoke execute
on function public.traverse_brand_graph(uuid, integer, text[])
from public, anon, authenticated;

grant execute
on function public.traverse_brand_graph(uuid, integer, text[])
to service_role;

alter function public.traverse_brand_graph(uuid, integer, text[])
  set search_path = public;

revoke execute
on function public.identify_rls_policies_needing_optimization()
from public, anon, authenticated;

grant execute
on function public.identify_rls_policies_needing_optimization()
to service_role;

alter function public.identify_rls_policies_needing_optimization()
  set search_path = '';
