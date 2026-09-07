-- IPI-307 · MODEL-P1 fix-forward — review of PR #176 (Codacy, optibot) on
-- 20260702160000's own reschedule fix.
--
-- Does not edit the already-pushed migration — new migration instead, per
-- this repo's own convention.
--
-- Rollback:
--   -- (re-add 20260702160000's log_booking_status_change body)
--
-- ---------------------------------------------------------------------------
-- Investigated but NOT changed: "talent_profile_id reassignment leaves a
-- zombie availability hold" (optibot x2, Codacy HIGH). The premise doesn't
-- hold given the current migration chain: talent.lock_booking_identity_columns()
-- (20260702150000) already locks talent_profile_id unconditionally via a
-- BEFORE UPDATE trigger — no null-guard carve-out like shoot_id/requested_by
-- have, since talent_profile_id is `not null ... on delete restrict` (no FK
-- cascade could ever null it either). BEFORE triggers run before AFTER
-- triggers and can abort the statement first — Postgres guarantees this
-- ordering, not just alphabetical tie-breaking within the same timing. So a
-- talent_profile_id-changing UPDATE never reaches log_booking_status_change's
-- body at all, for any role (RLS-scoped or service-role — triggers fire
-- regardless of role unless explicitly disabled, which nothing here does).
-- No application code path attempts this reassignment either (IPI-309
-- Booking Wizard, the only place that would, doesn't exist yet). Adding
-- talent_profile_id = excluded.talent_profile_id to the ON CONFLICT clauses
-- would be a correct-but-unreachable no-op given this invariant.
--
-- Fixed: Codacy MEDIUM — the date-only-reschedule branch's early return
-- suppressed the 'reschedule_requested' notification even when status stays
-- 'requested' (the one status with a distinct "reschedule" notification kind
-- by design — see the v_kind case below). Also folds in optibot's separate,
-- valid suggestion to de-duplicate the availability UPSERT block, which
-- appeared twice in 20260702160000 and would have become three copies to
-- patch this correctly otherwise.
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
  v_status_changed boolean;
  v_dates_changed boolean;
begin
  v_status_changed := tg_op = 'INSERT' or old.status is distinct from new.status;
  v_dates_changed := tg_op = 'UPDATE' and (
    old.date_start is distinct from new.date_start
    or old.date_end is distinct from new.date_end
  );

  if tg_op = 'UPDATE' and not v_status_changed and not v_dates_changed then
    return new;
  end if;

  -- History is a status-change audit trail — a date-only reschedule isn't
  -- a status change, so it never gets a (misleading) from_status = to_status
  -- row here.
  if v_status_changed then
    insert into talent.booking_status_history (booking_id, event_type, from_status, to_status, actor_id)
    values (
      new.id,
      case when new.status = 'expired' and tg_op = 'UPDATE' then 'system_expired' else 'status_change' end,
      case when tg_op = 'INSERT' then null else old.status end,
      new.status,
      auth.uid()
    );
  end if;

  -- Notification fires on any real status change, OR a date-only reschedule
  -- while still 'requested' — the only status with its own "reschedule"
  -- notification kind (reschedule_requested). Other statuses' date-only
  -- reschedules have no bespoke notification kind and stay silent, matching
  -- the pre-existing v_kind design (unchanged from 20260702160000).
  if v_status_changed or (new.status = 'requested' and v_dates_changed) then
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
  end if;

  -- Availability upsert — single block (was duplicated across the main and
  -- date-only paths in 20260702160000), driven by new.status/new.dates
  -- regardless of which one just changed.
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
  elsif v_status_changed and (
    new.status in ('declined', 'expired', 'cancelled')
    or (new.status = 'requested' and tg_op = 'UPDATE')
  ) then
    delete from talent.talent_availability where booking_id = new.id;
  end if;

  return new;
end;
$$;
