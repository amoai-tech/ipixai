-- IPI-577 · PLN-S6 — planner_get_member_names RPC
--
-- listMembers() (IPI-575, app/src/lib/planner/queries.ts) reads
-- planner.assignments directly and returns no display name/email — the
-- SELECT-only-own-row policy on public.profiles (authenticated_users_can_
-- view_own_profile: auth.uid() = id) means a plain join can never resolve
-- a teammate's name for the caller. The Settings member table (SCR-34)
-- needs real names ("Maya", "Priya"), not raw user_id values.
--
-- SECURITY DEFINER, same posture as public.planner_get_my_assignment
-- (public schema, search_path = '', authenticated-only grant): it bypasses
-- profiles' self-row RLS, but only for members of an instance the CALLER
-- is already assigned to (planner.is_at_least(p_instance_id, 'viewer')) —
-- it cannot be used to look up an arbitrary user's profile, and returns
-- zero rows for a caller with no assignment on p_instance_id.
--
-- display_name only, no email — rls-policy-auditor flagged that returning
-- email to every viewer-tier co-member is broader PII exposure than SCR-34
-- actually needs: the member table's columns are NAME/ROLE/ACCESS only, no
-- email column anywhere in the design. Add an email column later only if a
-- real UI need for it shows up — not speculatively.

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
  select p.id, p.full_name
  from planner.assignments a
  join public.profiles p on p.id = a.user_id
  where a.instance_id = p_instance_id
    and planner.is_at_least(p_instance_id, 'viewer');
$$;

comment on function public.planner_get_member_names is 'Resolves display_name for every assignment on an instance the caller is already assigned to (viewer+). SECURITY DEFINER, bypasses profiles'' self-row-only RLS narrowly — scoped by planner.is_at_least, not a general profile lookup. No email column — SCR-34''s member table never displays it.';

revoke all on function public.planner_get_member_names(uuid) from public;
revoke all on function public.planner_get_member_names(uuid) from anon;
grant execute on function public.planner_get_member_names(uuid) to authenticated;
;
