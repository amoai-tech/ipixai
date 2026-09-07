create or replace function public.check_talent_availability(
  p_talent_profile_id uuid,
  p_date_start date default null,
  p_date_end date default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, talent
as $func$
declare
  v_row jsonb;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  if p_talent_profile_id is null then
    raise exception 'talent_profile_id is required';
  end if;

  if p_date_start is not null and p_date_end is not null and p_date_start > p_date_end then
    raise exception 'invalid date range: start date must be on or before end date';
  end if;

  select to_jsonb(t) || jsonb_build_object(
    'rate_tier', talent.compute_rate_tier(t.id),
    'is_available', (
      (p_date_start is null and p_date_end is null)
      or not exists (
        select 1 from talent.talent_availability a
        where a.talent_profile_id = t.id
          and a.status in ('blocked', 'tentative', 'booked')
          and a.date_range && daterange(p_date_start, p_date_end, '[]')
      )
    )
  )
  into v_row
  from talent.talent_profiles_public t
  where t.id = p_talent_profile_id;

  if v_row is null then
    raise exception 'talent profile not found';
  end if;

  return v_row;
end;
$func$;

revoke all on function public.check_talent_availability(uuid, date, date) from public, anon;
grant execute on function public.check_talent_availability(uuid, date, date) to authenticated;
;
