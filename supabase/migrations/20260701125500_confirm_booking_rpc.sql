-- IPI-307 · MODEL-P1 — confirm_booking() RPC + crew-attach + status-change
-- audit/notification trigger.
--
-- Rollback:
--   drop trigger if exists trg_bookings_log_status_change on talent.bookings;
--   drop function if exists talent.log_booking_status_change();
--   drop function if exists public.confirm_booking(uuid);
--   alter table shoot.shoot_crew drop constraint if exists crew_exactly_one_fk;
--   alter table shoot.shoot_crew drop column if exists talent_profile_id;
--   (re-add the original 2-way crew_exactly_one_fk + unique index if truly reverting)

-- ---------------------------------------------------------------------------
-- Widen shoot.shoot_crew to support a talent-profile-backed crew member
-- (previously: internal_contact_id / marketplace_vendor_id only).
-- crew_role already includes 'model' — no enum change needed.
-- ---------------------------------------------------------------------------
alter table shoot.shoot_crew
  add column talent_profile_id uuid references talent.talent_profiles(id) on delete restrict;

alter table shoot.shoot_crew
  drop constraint crew_exactly_one_fk,
  add constraint crew_exactly_one_fk
    check (num_nonnulls(internal_contact_id, marketplace_vendor_id, talent_profile_id) = 1);

drop index if exists shoot.uq_shoot_crew_member;
create unique index uq_shoot_crew_member
  on shoot.shoot_crew(shoot_id, role, coalesce(internal_contact_id, marketplace_vendor_id, talent_profile_id));

-- ---------------------------------------------------------------------------
-- Status-change trigger — writes booking_status_history + notifications
-- automatically on every status transition (insert or update), so no API
-- route has to remember to do it per-transition (the risk flagged for
-- MODEL-023a in 06-model-booking-implementation-plan.md — removed at the
-- source instead of guarded against in application code).
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
  if tg_op = 'UPDATE' and old.status is not distinct from new.status then
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

  -- Availability derivation (Finding 1, notes-2.md verification round):
  -- quoted/approved -> tentative hold; confirmed -> firm booked hold;
  -- declined/expired/cancelled, or a reschedule back to 'requested' -> release
  -- the hold. Client writes to talent_availability are restricted to
  -- available/blocked only (see core schema migration) — tentative/booked
  -- exist exclusively as a side effect of this trigger.
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

create trigger trg_bookings_log_status_change
  after insert or update of status on talent.bookings
  for each row execute function talent.log_booking_status_change();

-- ---------------------------------------------------------------------------
-- confirm_booking() — transactional + idempotent. The ONLY path that may set
-- status='confirmed' (RLS on talent.bookings blocks it for authenticated
-- clients; this SECURITY DEFINER function bypasses RLS, called only from the
-- /api/bookings/[id]/approve route with a service-role client).
-- ---------------------------------------------------------------------------
create or replace function public.confirm_booking(p_booking_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, talent, shoot
as $$
declare
  v_booking talent.bookings%rowtype;
  v_crew_id uuid;
begin
  -- Conditional update: 0 rows if already confirmed or not in 'approved' —
  -- this is the idempotency guarantee (a retry is a no-op, not an error).
  update talent.bookings
  set status = 'confirmed'
  where id = p_booking_id and status = 'approved'
  returning * into v_booking;

  if v_booking.id is null then
    select * into v_booking from talent.bookings where id = p_booking_id;

    if v_booking.id is null then
      raise exception 'Booking % not found', p_booking_id;
    end if;

    if v_booking.status = 'confirmed' then
      return jsonb_build_object(
        'status', 'confirmed', 'already_confirmed', true,
        'booking_id', v_booking.id
      );
    end if;

    raise exception 'Booking % is not in approved state (current: %)', p_booking_id, v_booking.status;
  end if;

  if v_booking.shoot_id is not null then
    insert into shoot.shoot_crew (shoot_id, role, talent_profile_id, confirmed)
    values (v_booking.shoot_id, 'model', v_booking.talent_profile_id, true)
    on conflict (shoot_id, role, coalesce(internal_contact_id, marketplace_vendor_id, talent_profile_id))
      do update set confirmed = true
    returning id into v_crew_id;
  end if;

  return jsonb_build_object(
    'status', 'confirmed', 'already_confirmed', false,
    'booking_id', v_booking.id, 'crew_id', v_crew_id
  );
exception
  when exclusion_violation then
    raise exception 'Booking conflict: this talent already has a confirmed booking for an overlapping date range'
      using errcode = '23P01';
end;
$$;

revoke all on function public.confirm_booking(uuid) from public, anon, authenticated;
grant execute on function public.confirm_booking(uuid) to service_role;
