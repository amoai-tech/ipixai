-- IPI-536 · PR #347 review fix — planner_get_my_assignment RPC
--
-- Fixes a P1 bug found by automated PR review (Codex): permissions.ts read
-- planner.assignments directly with the caller's RLS-scoped client, but
-- assignments_select_org (20260709000000_planner_schema_rls.sql:468-470)
-- requires planner.is_at_least(id, 'manager') to SELECT any row at all — a
-- contributor/viewer checking their OWN permissions got zero rows back and
-- was silently treated as unassigned (canRead: false), even though
-- PlannerEngine.getEffectivePermissions would grant them access.
--
-- This function is SECURITY DEFINER but safe: it is hard-scoped to
-- auth.uid() via `where user_id = (select auth.uid())` and can never accept
-- a caller-supplied user id, so it cannot return another user's assignment
-- row or be used to enumerate other members. It only ever answers "what is
-- MY OWN role here", the same question assignments_select_org already lets
-- managers/owners ask in bulk.
--
-- public schema (not planner), mirrors public.crm_convert_deal's convention
-- (SECURITY DEFINER, set search_path = '', fully-qualified references).

create or replace function public.planner_get_my_assignment(p_instance_id uuid)
returns table (
  id uuid,
  instance_id uuid,
  user_id uuid,
  role text,
  permissions jsonb
)
language sql
security definer
set search_path = ''
stable
as $$
  select a.id, a.instance_id, a.user_id, a.role, a.permissions
  from planner.assignments a
  where a.instance_id = p_instance_id
    and a.user_id = (select auth.uid())
  limit 1;
$$;

comment on function public.planner_get_my_assignment is 'Returns the calling user''s own planner.assignments row for an instance, if any. SECURITY DEFINER, hard-scoped to auth.uid() — safe, narrow bypass of the manager-only assignments_select_org RLS policy so contributors/viewers can read their own permissions.';

-- Postgres grants EXECUTE to PUBLIC by default on function creation (unlike
-- tables) — explicitly revoke first, matching every other PostgREST-facing
-- security definer function in this repo (crm_convert_deal, get_shoot_detail,
-- transition_booking, etc.). Not exploitable even without this (anon's
-- auth.uid() is NULL, so the row predicate can never match), but rls-policy-
-- auditor flagged the missing revoke as a convention gap that would surface
-- in Supabase's security advisor lint.
revoke all on function public.planner_get_my_assignment(uuid) from public;
revoke all on function public.planner_get_my_assignment(uuid) from anon;
grant execute on function public.planner_get_my_assignment(uuid) to authenticated;
