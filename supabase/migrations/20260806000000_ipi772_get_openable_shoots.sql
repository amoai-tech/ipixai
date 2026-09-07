-- IPI-772 · SHOOT-WHERE-001 — batch shoot existence check for Where Used links.
--
-- PostgREST does not expose the `shoot` schema on the remote project
-- (PGRST106 on `Accept-Profile: shoot`; exposed list is public, graphql_public,
-- planner), so the operator app cannot query shoot.shoots through the Data API
-- directly. This public RPC returns the subset of the given shoot ids the
-- caller may open.
--
-- SECURITY INVOKER by design: the org-aware RLS policy `shoots_select_owner`
-- (shoot.shoots, via is_org_member(brands.org_id)) applies under the caller's
-- identity — the same visibility predicate get_shoot_detail enforces. No
-- org logic is duplicated here.
--
-- Rollback: drop function if exists public.get_openable_shoots(uuid[]);

create or replace function public.get_openable_shoots(p_shoot_ids uuid[])
returns table (id uuid)
language sql
security invoker
set search_path = ''
stable
as $$
  select s.id
  from shoot.shoots s
  where s.id = any(p_shoot_ids)
$$;

-- Explicit, per IPI-896 convention (PUBLIC EXECUTE would cover it, but authors
-- must declare grants; anon intentionally omitted — it has no shoot.shoots
-- SELECT grant and the app never calls this path as anon).
grant execute on function public.get_openable_shoots(uuid[]) to authenticated;
