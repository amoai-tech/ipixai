-- IPI-340 · MG-3 — create_booking_request() RPC (wizard insert-only path).
-- Scope: insert requested booking only — no FSM transitions (MG-4).
--
-- Verify:
--   infisical run -- npm run supabase:verify-rls
--   infisical run -- node scripts/test-create-booking-request.mjs
--   npm run supabase:types
--
-- Rollback:
--   drop function if exists public.create_booking_request(uuid, uuid, date, date, uuid, numeric, text);

create or replace function public.create_booking_request(
  p_brand_org_id uuid,
  p_talent_profile_id uuid,
  p_date_start date,
  p_date_end date,
  p_shoot_id uuid default null,
  p_rate_quoted numeric(10,2) default null,
  p_message text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, talent, shoot
as $func$
declare
  v_booking_id uuid;
  v_status text;
  v_version integer;
  v_expires_at timestamptz;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  if p_brand_org_id is null or not public.is_org_member(p_brand_org_id) then
    raise exception 'not a member of this organization';
  end if;

  if p_date_start is null or p_date_end is null then
    raise exception 'date_start and date_end are required';
  end if;

  if p_date_start > p_date_end then
    raise exception 'invalid date range: start date must be on or before end date';
  end if;

  if p_date_start < current_date then
    raise exception 'start date cannot be in the past';
  end if;

  if p_rate_quoted is not null and p_rate_quoted < 0 then
    raise exception 'rate_quoted must be non-negative';
  end if;

  if not exists (
    select 1 from talent.talent_profiles tp where tp.id = p_talent_profile_id
  ) then
    raise exception 'talent profile not found';
  end if;

  if p_shoot_id is not null then
    if not exists (
      select 1
      from shoot.shoots s
      inner join public.brands b on b.id = s.brand_id
      where s.id = p_shoot_id
        and b.org_id = p_brand_org_id
    ) then
      raise exception 'shoot not found';
    end if;
  end if;

  insert into talent.bookings (
    brand_org_id,
    talent_profile_id,
    shoot_id,
    status,
    date_start,
    date_end,
    rate_quoted,
    message,
    requested_by
  )
  values (
    p_brand_org_id,
    p_talent_profile_id,
    p_shoot_id,
    'requested',
    p_date_start,
    p_date_end,
    p_rate_quoted,
    p_message,
    auth.uid()
  )
  returning id, status, version, expires_at
  into v_booking_id, v_status, v_version, v_expires_at;

  return jsonb_build_object(
    'booking_id', v_booking_id,
    'status', v_status,
    'version', v_version,
    'expires_at', v_expires_at
  );
end;
$func$;

revoke all on function public.create_booking_request(uuid, uuid, date, date, uuid, numeric, text)
  from public, anon;
grant execute on function public.create_booking_request(uuid, uuid, date, date, uuid, numeric, text)
  to authenticated;
