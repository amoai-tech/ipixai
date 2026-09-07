-- IPI-476 · PLAN-RT-001 follow-up
-- Viewers may subscribe (SELECT) but must not INSERT on planner:<instance_id>.
-- Client broadcast requires contributor+; server triggers use SECURITY DEFINER.

create or replace function planner.can_broadcast_instance(p_topic text)
returns boolean
language sql
security definer
set search_path = planner, public
stable
as $$
  select case
    when p_topic ~ '^planner:[0-9a-f-]{36}$' then
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

grant execute on function planner.can_broadcast_instance(text) to authenticated, service_role;

drop policy if exists "planner_channel_broadcast" on realtime.messages;

create policy "planner_channel_broadcast"
  on realtime.messages
  for insert
  to authenticated
  with check (
    realtime.topic() like 'planner:%'
    and planner.can_broadcast_instance(realtime.topic())
  );
