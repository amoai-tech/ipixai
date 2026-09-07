-- IPI-307 · MODEL-P1 fix-forward — corrects a regression introduced by
-- 20260702140000's talent.lock_booking_identity_columns() trigger.
--
-- Does not edit the already-pushed migration — new migration instead, per
-- this repo's own convention.
--
-- Rollback:
--   -- (re-add the 20260702140000 body: unconditional `is distinct from`
--   --  checks on shoot_id/requested_by, no null-transition carve-out)

-- ---------------------------------------------------------------------------
-- optibot [Bug] — the identity-lock trigger fired on every BEFORE UPDATE with
-- no carve-out for a non-null -> null transition, so it also intercepted
-- Postgres's own FK-cascade SET NULL propagation. `shoot.shoot_id` and
-- `requested_by` both use `on delete set null`; deleting a shoot or a user
-- account with any bookings attached would issue `UPDATE talent.bookings SET
-- shoot_id = NULL` (or `requested_by = NULL`) as part of the cascade, the
-- trigger would see `new.* IS DISTINCT FROM old.*` (NULL vs. an old UUID),
-- raise, and abort the entire DELETE — making it impossible to delete a shoot
-- or a user account that ever had a talent booking.
--
-- Fix: only block the transition when the NEW value is itself non-null and
-- different from the old one — i.e. block a client reassigning shoot_id/
-- requested_by to a *different* entity, but allow the FK cascade's
-- non-null -> null transition through. brand_org_id (on delete cascade,
-- removes the row entirely) and talent_profile_id (on delete restrict,
-- blocked at the FK level before any trigger fires) have no such conflict
-- and keep their unconditional lock.
-- ---------------------------------------------------------------------------
create or replace function talent.lock_booking_identity_columns()
returns trigger
language plpgsql
set search_path = talent, public
as $$
begin
  if new.brand_org_id is distinct from old.brand_org_id
     or new.talent_profile_id is distinct from old.talent_profile_id
     or (new.shoot_id is not null and new.shoot_id is distinct from old.shoot_id)
     or (new.requested_by is not null and new.requested_by is distinct from old.requested_by)
  then
    raise exception 'bookings: brand_org_id, talent_profile_id, shoot_id, and requested_by are immutable after creation';
  end if;
  return new;
end;
$$;
