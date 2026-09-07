-- IPI-341 · MG-4 — transition_booking() RPC + bookings RLS status lockdown.

create or replace function public.transition_booking(
  p_booking_id uuid,
  p_expected_version integer,
  p_to_status text default null,
  p_rate_quoted numeric(10,2) default null,
  p_date_start date default null,
  p_date_end date default null,
  p_cancellation_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, talent, shoot
as $func$
declare
  v_booking talent.bookings%rowtype;
  v_from_status text;
  v_is_brand boolean;
  v_is_talent boolean;
  v_is_agency boolean;
  v_allowed boolean;
  v_date_only boolean;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  if p_booking_id is null then
    raise exception 'booking_id is required';
  end if;

  if p_expected_version is null then
    raise exception 'expected_version is required';
  end if;

  select * into v_booking
  from talent.bookings
  where id = p_booking_id;

  if v_booking.id is null then
    raise exception 'booking not found';
  end if;

  v_from_status := v_booking.status;

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

  if v_booking.version is distinct from p_expected_version then
    raise exception 'stale_booking';
  end if;

  v_date_only := p_to_status is null;

  if v_date_only then
    if v_from_status not in ('requested', 'quoted') then
      raise exception 'invalid_transition';
    end if;

    if p_date_start is null or p_date_end is null then
      raise exception 'date_start and date_end are required for reschedule';
    end if;

    if p_date_start > p_date_end then
      raise exception 'invalid date range: start date must be on or before end date';
    end if;

    update talent.bookings
    set
      date_start = p_date_start,
      date_end = p_date_end,
      version = version + 1
    where id = p_booking_id
      and version = p_expected_version
    returning * into v_booking;

    if v_booking.id is null then
      raise exception 'stale_booking';
    end if;

    return jsonb_build_object(
      'booking_id', v_booking.id,
      'status', v_booking.status,
      'version', v_booking.version,
      'from_status', v_from_status,
      'to_status', v_booking.status,
      'date_start', v_booking.date_start,
      'date_end', v_booking.date_end
    );
  end if;

  if p_to_status in ('confirmed', 'expired') then
    raise exception 'invalid_transition';
  end if;

  if v_from_status in ('declined', 'expired', 'cancelled') then
    raise exception 'invalid_transition';
  end if;

  if p_to_status = 'cancelled' then
    if p_cancellation_reason is null or btrim(p_cancellation_reason) = '' then
      raise exception 'cancellation_reason_required';
    end if;
  end if;

  if v_from_status = 'requested' and p_to_status = 'quoted' then
    v_allowed := v_is_talent or v_is_agency;
    if p_rate_quoted is null or p_rate_quoted < 0 then
      raise exception 'rate_quoted is required for quoted transition';
    end if;
  elsif v_from_status = 'requested' and p_to_status = 'approved' then
    v_allowed := v_is_brand;
  elsif v_from_status = 'requested' and p_to_status = 'declined' then
    v_allowed := v_is_brand or v_is_talent or v_is_agency;
  elsif v_from_status = 'requested' and p_to_status = 'cancelled' then
    v_allowed := v_is_brand or v_is_talent or v_is_agency;
  elsif v_from_status = 'quoted' and p_to_status = 'approved' then
    v_allowed := v_is_brand;
  elsif v_from_status = 'quoted' and p_to_status = 'declined' then
    v_allowed := v_is_brand or v_is_talent or v_is_agency;
  elsif v_from_status = 'quoted' and p_to_status = 'cancelled' then
    v_allowed := v_is_brand or v_is_talent or v_is_agency;
  elsif v_from_status = 'quoted' and p_to_status = 'requested' then
    v_allowed := v_is_brand or v_is_talent or v_is_agency;
  elsif v_from_status = 'approved' and p_to_status = 'cancelled' then
    v_allowed := v_is_brand or v_is_talent or v_is_agency;
  elsif v_from_status = 'confirmed' and p_to_status = 'cancelled' then
    v_allowed := v_is_brand or v_is_talent or v_is_agency;
  else
    v_allowed := false;
  end if;

  if not coalesce(v_allowed, false) then
    raise exception 'invalid_transition';
  end if;

  if p_date_start is not null or p_date_end is not null then
    if p_date_start is null or p_date_end is null then
      raise exception 'date_start and date_end must both be provided when rescheduling';
    end if;
    if p_date_start > p_date_end then
      raise exception 'invalid date range: start date must be on or before end date';
    end if;
  end if;

  update talent.bookings
  set
    status = p_to_status,
    version = version + 1,
    rate_quoted = case
      when p_to_status = 'quoted' then p_rate_quoted
      else rate_quoted
    end,
    date_start = coalesce(p_date_start, date_start),
    date_end = coalesce(p_date_end, date_end),
    approved_by = case
      when p_to_status = 'approved' then auth.uid()
      else approved_by
    end,
    cancelled_by = case
      when p_to_status = 'cancelled' then auth.uid()
      else cancelled_by
    end,
    cancellation_reason = case
      when p_to_status = 'cancelled' then p_cancellation_reason
      else cancellation_reason
    end
  where id = p_booking_id
    and version = p_expected_version
  returning * into v_booking;

  if v_booking.id is null then
    raise exception 'stale_booking';
  end if;

  return jsonb_build_object(
    'booking_id', v_booking.id,
    'status', v_booking.status,
    'version', v_booking.version,
    'from_status', v_from_status,
    'to_status', v_booking.status,
    'date_start', v_booking.date_start,
    'date_end', v_booking.date_end,
    'rate_quoted', v_booking.rate_quoted,
    'approved_by', v_booking.approved_by,
    'cancelled_by', v_booking.cancelled_by,
    'cancellation_reason', v_booking.cancellation_reason
  );
end;
$func$;

revoke all on function public.transition_booking(uuid, integer, text, numeric, date, date, text)
  from public, anon;
grant execute on function public.transition_booking(uuid, integer, text, numeric, date, date, text)
  to authenticated;

drop policy if exists bookings_update_party on talent.bookings;

create policy bookings_update_party on talent.bookings
  for update to authenticated
  using (false);
