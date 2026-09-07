-- IPI-307 · MODEL-P1 fix-forward — two gaps found in review of PR #175 after
-- it merged (20260702140000's own reschedule fix had a follow-on bug, and a
-- delete-policy gap was missed when insert/update were tightened).
--
-- Does not edit the already-merged migrations — new migration instead, per
-- this repo's own convention.
--
-- Rollback:
--   -- (re-add 20260702140000's log_booking_status_change body: single
--   --  compound early-return guard, no separate date-only branch)
--   drop policy if exists talent_availability_delete_owner on talent.talent_availability;
--   create policy talent_availability_delete_owner on talent.talent_availability
--     for delete to authenticated
--     using (
--       talent_profile_id in (
--         select id from talent.talent_profiles
--         where profile_id = (select auth.uid())
--            or public.is_org_editor_or_above(agency_org_id)
--       )
--     );

-- ---------------------------------------------------------------------------
-- 20260702140000 widened the trigger to fire on date_start/date_end changes
-- so a reschedule refreshes the availability hold — but its early-return
-- guard was one compound condition covering both "should this trigger no-op
-- entirely" and "should availability still refresh". A date-only change
-- (status unchanged) correctly falls through past that guard, but then also
-- falls through the booking_status_history INSERT (writing a 'status_change'
-- row with from_status = to_status — a no-op status change logged as if it
-- were real) and the notifications INSERT (re-firing e.g. 'booking_approved'
-- as a duplicate). Splitting the date-only case into its own branch — run
-- only the availability upsert, then return — fixes both without touching
-- the all-unchanged guard or the status-driven history/notification path.
-- ---------------------------------------------------------------------------
create or replace function talent.log_booking_status_change()
returns trigger
language plpgsql
security definer
set search_path = talent, public
as $$
declare
  v_kind text;
  v_agency_org_id uuid;
begin
  if tg_op = 'UPDATE'
     and old.status is not distinct from new.status
     and old.date_start is not distinct from new.date_start
     and old.date_end is not distinct from new.date_end
  then
    return new;
  end if;

  -- date-only reschedule: refresh availability, skip history + notification
  if tg_op = 'UPDATE'
     and old.status is not distinct from new.status
     and (old.date_start is distinct from new.date_start
          or old.date_end is distinct from new.date_end)
  then
    if new.status in ('quoted', 'approved', 'confirmed') then
      insert into talent.talent_availability (talent_profile_id, booking_id, date_range, status)
      values (
        new.talent_profile_id,
        new.id,
        daterange(new.date_start, new.date_end, '[]'),
        case when new.status = 'confirmed' then 'booked' else 'tentative' end
      )
      on conflict (booking_id) where booking_id is not null
        do update set
          date_range = excluded.date_range,
          status = excluded.status;
    end if;
    return new;
  end if;

  insert into talent.booking_status_history (booking_id, event_type, from_status, to_status, actor_id)
  values (
    new.id,
    case when new.status = 'expired' and tg_op = 'UPDATE' then 'system_expired' else 'status_change' end,
    case when tg_op = 'INSERT' then null else old.status end,
    new.status,
    auth.uid()
  );

  v_kind := case new.status
    when 'requested' then (case when tg_op = 'INSERT' then 'booking_requested' else 'reschedule_requested' end)
    when 'quoted' then 'booking_quoted'
    when 'approved' then 'booking_approved'
    when 'confirmed' then 'booking_confirmed'
    when 'declined' then 'booking_declined'
    when 'expired' then 'booking_expired'
    when 'cancelled' then 'booking_cancelled'
    else 'booking_requested'
  end;

  select agency_org_id into v_agency_org_id
  from talent.talent_profiles where id = new.talent_profile_id;

  insert into public.notifications (kind, payload, brand_org_id, talent_profile_id, agency_org_id)
  values (
    v_kind,
    jsonb_build_object('booking_id', new.id, 'status', new.status),
    new.brand_org_id,
    new.talent_profile_id,
    v_agency_org_id
  );

  if new.status in ('quoted', 'approved', 'confirmed') then
    insert into talent.talent_availability (talent_profile_id, booking_id, date_range, status)
    values (
      new.talent_profile_id,
      new.id,
      daterange(new.date_start, new.date_end, '[]'),
      case when new.status = 'confirmed' then 'booked' else 'tentative' end
    )
    on conflict (booking_id) where booking_id is not null
      do update set
        date_range = excluded.date_range,
        status = excluded.status;
  elsif new.status in ('declined', 'expired', 'cancelled')
     or (new.status = 'requested' and tg_op = 'UPDATE') then
    delete from talent.talent_availability where booking_id = new.id;
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- talent_availability_delete_owner had no booking_id is null restriction —
-- 20260702140000 tightened insert/update to block clients from touching
-- trigger-owned tentative/booked rows but missed delete, so an owner or
-- agency editor could directly DELETE a system-derived hold, silently
-- freeing a slot the bookings table still shows as confirmed/approved.
-- ---------------------------------------------------------------------------
drop policy if exists talent_availability_delete_owner on talent.talent_availability;
create policy talent_availability_delete_owner on talent.talent_availability
  for delete to authenticated
  using (
    booking_id is null
    and talent_profile_id in (
      select id from talent.talent_profiles
      where profile_id = (select auth.uid())
         or public.is_org_editor_or_above(agency_org_id)
    )
  );
