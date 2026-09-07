-- IPI-476 · PLAN-RT-001 follow-up
-- Tighten topic UUID guard: [0-9a-f-]{36} matched non-UUIDs (e.g. all-hyphens),
-- then ::uuid raised during policy eval → Realtime CHANNEL_ERROR.
-- Use canonical UUID shape + case-insensitive match (~*).

create or replace function planner.can_subscribe_instance(p_topic text)
returns boolean
language sql
security definer
set search_path = planner, public
stable
as $$
  select case
    when p_topic ~* '^planner:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      exists (
        select 1
        from planner.instances i
        where i.id = substring(p_topic from 9)::uuid
          and public.is_org_member(i.org_id)
          and planner.is_at_least(i.id, 'viewer')
      )
    else false
  end;
$$;

comment on function planner.can_subscribe_instance is
  'Realtime auth helper — true when auth.uid() may subscribe to planner:<instance_id>.';

create or replace function planner.can_broadcast_instance(p_topic text)
returns boolean
language sql
security definer
set search_path = planner, public
stable
as $$
  select case
    when p_topic ~* '^planner:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      exists (
        select 1
        from planner.instances i
        where i.id = substring(p_topic from 9)::uuid
          and public.is_org_member(i.org_id)
          and planner.is_at_least(i.id, 'contributor')
      )
    else false
  end;
$$;

comment on function planner.can_broadcast_instance is
  'Realtime auth helper — true when auth.uid() may INSERT/broadcast on planner:<instance_id> (contributor+).';
