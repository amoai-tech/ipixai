-- IPI-476 · PLAN-RT-001
-- Realtime private-channel auth: policies that JOIN user tables from
-- realtime.messages often fail with CHANNEL_ERROR (supabase/realtime#1111).
-- Wrap the check in a SECURITY DEFINER helper; add INSERT policy for broadcast.

create or replace function planner.can_subscribe_instance(p_topic text)
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
          and planner.is_at_least(i.id, 'viewer')
      )
    else false
  end;
$$;

comment on function planner.can_subscribe_instance is
  'Realtime auth helper — true when auth.uid() may subscribe to planner:<instance_id>.';

grant execute on function planner.can_subscribe_instance(text) to authenticated, service_role;

drop policy if exists "planner_channel_subscribe" on realtime.messages;

create policy "planner_channel_subscribe"
  on realtime.messages
  for select
  to authenticated
  using (
    realtime.topic() like 'planner:%'
    and planner.can_subscribe_instance(realtime.topic())
  );

drop policy if exists "planner_channel_broadcast" on realtime.messages;

create policy "planner_channel_broadcast"
  on realtime.messages
  for insert
  to authenticated
  with check (
    realtime.topic() like 'planner:%'
    and planner.can_subscribe_instance(realtime.topic())
  );
