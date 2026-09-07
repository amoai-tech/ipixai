-- IPI-342 · MG-5 — get_booking() + list_bookings() read RPCs.
-- Party-scoped reads for booking detail and role inboxes.
--
-- Verify:
--   infisical run -- npm run supabase:verify-rls
--   psql -v ON_ERROR_STOP=1 "$DATABASE_URL" -f scripts/test-get-list-bookings.sql
--   cd app && npm run typecheck
--
-- Rollback:
--   drop function if exists public.get_booking(uuid);
--   drop function if exists public.list_bookings(text, uuid, uuid, text[], text, integer);
--   drop function if exists talent.booking_row_to_jsonb(talent.bookings);

-- Explicit party-visible booking shape (matches api-contracts I.2/I.3; not SELECT *).
create or replace function talent.booking_row_to_jsonb(b talent.bookings)
returns jsonb
language sql
stable
set search_path = pg_catalog, talent
as $helper$
  select jsonb_build_object(
    'id', b.id,
    'brand_org_id', b.brand_org_id,
    'talent_profile_id', b.talent_profile_id,
    'shoot_id', b.shoot_id,
    'status', b.status,
    'date_start', b.date_start,
    'date_end', b.date_end,
    'rate_quoted', b.rate_quoted,
    'message', b.message,
    'requested_by', b.requested_by,
    'approved_by', b.approved_by,
    'cancelled_by', b.cancelled_by,
    'cancellation_reason', b.cancellation_reason,
    'expires_at', b.expires_at,
    'created_at', b.created_at,
    'updated_at', b.updated_at,
    'version', b.version
  );
$helper$;

create or replace function public.get_booking(p_booking_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, talent, shoot
as $func$
declare
  v_booking talent.bookings%rowtype;
  v_is_brand boolean;
  v_is_talent boolean;
  v_is_agency boolean;
  v_viewer_role text;
  v_talent jsonb;
  v_history jsonb;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  if p_booking_id is null then
    raise exception 'booking_id is required';
  end if;

  select * into v_booking
  from talent.bookings
  where id = p_booking_id;

  if v_booking.id is null then
    raise exception 'booking not found';
  end if;

  v_is_brand := public.is_org_member(v_booking.brand_org_id);

  select exists (
    select 1
    from talent.talent_profiles tp
    where tp.id = v_booking.talent_profile_id
      and tp.profile_id = auth.uid()
  ) into v_is_talent;

  select exists (
    select 1
    from talent.talent_profiles tp
    where tp.id = v_booking.talent_profile_id
      and tp.agency_org_id is not null
      and public.is_org_member(tp.agency_org_id)
  ) into v_is_agency;

  if not (v_is_brand or v_is_talent or v_is_agency) then
    raise exception 'not authorized for this booking';
  end if;

  if v_is_brand then
    v_viewer_role := 'brand';
  elsif v_is_talent then
    v_viewer_role := 'talent';
  else
    v_viewer_role := 'agency';
  end if;

  select to_jsonb(t) into v_talent
  from talent.talent_profiles_public t
  where t.id = v_booking.talent_profile_id;

  select coalesce(
    (
      select jsonb_agg(to_jsonb(h) order by h.created_at desc)
      from (
        select *
        from talent.booking_status_history
        where booking_id = p_booking_id
        order by created_at desc
        limit 50
      ) h
    ),
    '[]'::jsonb
  ) into v_history;

  return jsonb_build_object(
    'booking', talent.booking_row_to_jsonb(v_booking),
    'talent', coalesce(v_talent, 'null'::jsonb),
    'history', v_history,
    'viewer_role', v_viewer_role
  );
end;
$func$;

create or replace function public.list_bookings(
  p_role text,
  p_org_id uuid default null,
  p_talent_profile_id uuid default null,
  p_status text[] default null,
  p_cursor text default null,
  p_limit integer default 25
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, talent, shoot
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

  if p_role is null or p_role not in ('brand', 'talent', 'agency') then
    raise exception 'invalid role';
  end if;

  v_limit := least(greatest(coalesce(p_limit, 25), 1), 50);

  if p_role = 'brand' then
    if p_org_id is null then
      raise exception 'org_id is required for brand role';
    end if;
    if not public.is_org_member(p_org_id) then
      raise exception 'not a member of this organization';
    end if;
  elsif p_role = 'talent' then
    if p_talent_profile_id is null then
      raise exception 'talent_profile_id is required for talent role';
    end if;
    if not exists (
      select 1
      from talent.talent_profiles tp
      where tp.id = p_talent_profile_id
        and tp.profile_id = auth.uid()
    ) then
      raise exception 'not authorized for this talent profile';
    end if;
  elsif p_role = 'agency' then
    if p_org_id is null then
      raise exception 'org_id is required for agency role';
    end if;
    if not public.is_org_member(p_org_id) then
      raise exception 'not a member of this organization';
    end if;
  end if;

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
      talent.booking_row_to_jsonb(bk) as item,
      bk.created_at,
      bk.id
    from talent.bookings bk
    where (
      (p_role = 'brand' and bk.brand_org_id = p_org_id)
      or (
        p_role = 'talent'
        and bk.talent_profile_id = p_talent_profile_id
      )
      or (
        p_role = 'agency'
        and bk.talent_profile_id in (
          select tp.id
          from talent.talent_profiles tp
          where tp.agency_org_id = p_org_id
        )
      )
    )
    and (p_status is null or bk.status = any (p_status))
    and (
      p_cursor is null
      or (bk.created_at, bk.id) < (v_cursor_ts, v_cursor_id)
    )
    order by bk.created_at desc, bk.id desc
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

revoke all on function public.get_booking(uuid) from public, anon;
grant execute on function public.get_booking(uuid) to authenticated;

revoke all on function public.list_bookings(text, uuid, uuid, text[], text, integer)
  from public, anon;
grant execute on function public.list_bookings(text, uuid, uuid, text[], text, integer)
  to authenticated;
