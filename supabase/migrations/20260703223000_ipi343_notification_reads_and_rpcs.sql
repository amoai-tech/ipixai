-- IPI-343 · MG-5 — notification_reads junction + list/mark RPCs.
-- Per-user read semantics; revoke direct UPDATE on notifications.read.
--
-- Verify:
--   infisical run -- npm run supabase:verify-rls
--   psql -v ON_ERROR_STOP=1 "$DATABASE_URL" -f scripts/test-notification-reads-rls.sql
--   psql -v ON_ERROR_STOP=1 "$DATABASE_URL" -f scripts/test-booking-notifications-trigger.sql
--
-- Rollback:
--   drop function if exists public.mark_notifications_read(uuid[], boolean);
--   drop function if exists public.list_notifications(integer, text, boolean);
--   drop function if exists public.notification_row_to_jsonb(public.notifications);
--   drop table if exists public.notification_reads;
--   -- restore notifications_update_read_state + grant update from 20260701135900

create table public.notification_reads (
  user_id uuid not null references auth.users (id) on delete cascade,
  notification_id uuid not null references public.notifications (id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (user_id, notification_id)
);

create index idx_notification_reads_user_read_at
  on public.notification_reads (user_id, read_at desc);

alter table public.notification_reads enable row level security;

create policy notification_reads_select_own on public.notification_reads
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy notification_reads_insert_own on public.notification_reads
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy notification_reads_update_own on public.notification_reads
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

grant select, insert, update on public.notification_reads to authenticated;
grant all on public.notification_reads to service_role;

-- Layer 2 lockdown: clients must use mark_notifications_read (junction), not shared read column.
drop policy if exists notifications_update_read_state on public.notifications;

create policy notifications_update_read_state on public.notifications
  for update to authenticated
  using (false)
  with check (false);

revoke update on public.notifications from authenticated;

-- Replaces body only; trigger trg_notifications_lock_immutable_columns (20260701135900) remains attached.
create or replace function public.notifications_lock_immutable_columns()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if new.read is distinct from old.read
     or new.kind is distinct from old.kind
     or new.payload is distinct from old.payload
     or new.brand_org_id is distinct from old.brand_org_id
     or new.talent_profile_id is distinct from old.talent_profile_id
     or new.agency_org_id is distinct from old.agency_org_id
  then
    raise exception 'notifications: direct updates are not allowed';
  end if;
  return new;
end;
$$;

create or replace function public.notification_visible_to_caller(n public.notifications)
returns boolean
language sql
stable
set search_path = pg_catalog, public, talent
as $$
  select (
    (n.brand_org_id is not null and public.is_org_member(n.brand_org_id))
    or (n.agency_org_id is not null and public.is_org_member(n.agency_org_id))
    or (
      n.talent_profile_id is not null
      and n.talent_profile_id in (
        select tp.id
        from talent.talent_profiles tp
        where tp.profile_id = (select auth.uid())
      )
    )
  );
$$;

create or replace function public.notification_row_to_jsonb(n public.notifications)
returns jsonb
language sql
stable
set search_path = pg_catalog, public
as $helper$
  select jsonb_build_object(
    'id', n.id,
    'kind', n.kind,
    'payload', n.payload,
    'created_at', n.created_at,
    'read', exists (
      select 1
      from public.notification_reads nr
      where nr.notification_id = n.id
        and nr.user_id = (select auth.uid())
    ),
    'deep_link', case
      when n.payload ? 'booking_id'
        then '/app/bookings/' || (n.payload->>'booking_id')
      else null
    end
  );
$helper$;

create or replace function public.list_notifications(
  p_limit integer default 25,
  p_cursor text default null,
  p_unread_only boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, talent
as $func$
declare
  v_limit integer;
  v_cursor_ts timestamptz;
  v_cursor_id uuid;
  v_all jsonb;
  v_items jsonb;
  v_next_cursor text;
  v_len integer;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  v_limit := least(greatest(coalesce(p_limit, 25), 1), 50);

  if p_cursor is not null then
    if split_part(p_cursor, '|', 2) = '' then
      raise exception 'invalid cursor';
    end if;
    v_cursor_ts := split_part(p_cursor, '|', 1)::timestamptz;
    v_cursor_id := split_part(p_cursor, '|', 2)::uuid;
  end if;

  select coalesce(
    jsonb_agg(page.item order by page.created_at desc, page.id desc),
    '[]'::jsonb
  )
  into v_all
  from (
    select
      public.notification_row_to_jsonb(n) as item,
      n.created_at,
      n.id
    from public.notifications n
    where public.notification_visible_to_caller(n)
    and (
      not coalesce(p_unread_only, false)
      or not exists (
        select 1
        from public.notification_reads nr
        where nr.notification_id = n.id
          and nr.user_id = auth.uid()
      )
    )
    and (
      p_cursor is null
      or (n.created_at, n.id) < (v_cursor_ts, v_cursor_id)
    )
    order by n.created_at desc, n.id desc
    limit v_limit + 1
  ) page;

  v_len := jsonb_array_length(v_all);

  if v_len > v_limit then
    v_items := v_all - v_limit;
    v_next_cursor :=
      (v_all->(v_limit - 1)->>'created_at')
      || '|'
      || (v_all->(v_limit - 1)->>'id');
  else
    v_items := v_all;
    v_next_cursor := null;
  end if;

  return jsonb_build_object(
    'items', v_items,
    'next_cursor', v_next_cursor
  );
end;
$func$;

create or replace function public.mark_notifications_read(
  p_notification_ids uuid[] default null,
  p_mark_all boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, talent
as $func$
declare
  v_uid uuid := auth.uid();
  v_updated integer := 0;
  v_distinct_ids integer;
  v_visible_ids integer;
begin
  if v_uid is null then
    raise exception 'authentication required';
  end if;

  if coalesce(p_mark_all, false) then
    insert into public.notification_reads (user_id, notification_id, read_at)
    select v_uid, n.id, now()
    from public.notifications n
    where public.notification_visible_to_caller(n)
    and not exists (
      select 1
      from public.notification_reads nr
      where nr.notification_id = n.id
        and nr.user_id = v_uid
    )
    on conflict (user_id, notification_id) do update
      set read_at = excluded.read_at;

    get diagnostics v_updated = row_count;
    return jsonb_build_object('updated_count', v_updated);
  end if;

  if p_notification_ids is null or array_length(p_notification_ids, 1) is null then
    raise exception 'notification_ids is required';
  end if;

  if array_length(p_notification_ids, 1) > 100 then
    raise exception 'too many notification ids';
  end if;

  select count(distinct req.id)
  into v_distinct_ids
  from unnest(p_notification_ids) as req(id);

  select count(distinct n.id)
  into v_visible_ids
  from unnest(p_notification_ids) as req(id)
  join public.notifications n on n.id = req.id
  where public.notification_visible_to_caller(n);

  if v_visible_ids <> v_distinct_ids then
    raise exception 'not authorized for notification';
  end if;

  insert into public.notification_reads (user_id, notification_id, read_at)
  select v_uid, n.id, now()
  from unnest(p_notification_ids) as req(id)
  join public.notifications n on n.id = req.id
  where public.notification_visible_to_caller(n)
  on conflict (user_id, notification_id) do update
    set read_at = excluded.read_at;

  get diagnostics v_updated = row_count;

  return jsonb_build_object('updated_count', v_updated);
end;
$func$;

revoke all on function public.list_notifications(integer, text, boolean)
  from public, anon;
grant execute on function public.list_notifications(integer, text, boolean)
  to authenticated;

revoke all on function public.mark_notifications_read(uuid[], boolean)
  from public, anon;
grant execute on function public.mark_notifications_read(uuid[], boolean)
  to authenticated;
