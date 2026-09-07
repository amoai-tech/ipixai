-- IPI-587 follow-up: COALESCE profiles.full_name so the generated return type
-- is truly `string` (not `string | null` from a generator heuristic).
-- profiles.full_name is nullable; the original SELECT p.full_name could
-- return NULL, but the Supabase type generator sometimes infers non-null for
-- function return types, causing type drift. COALESCE to '' makes the
-- contract explicit and the generator's output correct on next regen.

create or replace function public.planner_get_member_names(p_instance_id uuid)
returns table (
  user_id uuid,
  display_name text
)
language sql
security definer
set search_path = ''
stable
as $$
  select p.id, coalesce(p.full_name, '') as display_name
  from planner.assignments a
  join public.profiles p on p.id = a.user_id
  where a.instance_id = p_instance_id
    and planner.is_at_least(p_instance_id, 'viewer');
$$;

comment on function public.planner_get_member_names is 'Resolves display_name for every assignment on an instance the caller is already assigned to (viewer+). SECURITY DEFINER, bypasses profiles'' self-row-only RLS narrowly — scoped by planner.is_at_least, not a general profile lookup. display_name is COALESCE''d to '' to avoid nullable type drift.';

revoke all on function public.planner_get_member_names(uuid) from public;
revoke all on function public.planner_get_member_names(uuid) from anon;
grant execute on function public.planner_get_member_names(uuid) to authenticated;
