-- IPI-307 · MODEL-P1 fix-forward — addresses PR #175 review findings (Codacy,
-- optibot, CodeRabbit) against the already-applied 20260701* migrations.
--
-- Does not edit the already-pushed migrations — new migration instead, per
-- this repo's own convention (see 20260701135900_notifications_rls_tighten.sql).
--
-- Rollback:
--   alter table talent.talent_profiles
--     drop constraint talent_profiles_profile_id_fkey,
--     add constraint talent_profiles_profile_id_fkey
--       foreign key (profile_id) references auth.users(id) on delete set null;
--   grant select on talent.talent_profiles_public to anon;
--   -- (re-add prior notifications_lock_immutable_columns body without id/created_at/channel)
--   -- (re-add prior log_booking_status_change body + trigger with `update of status` only)
--   drop policy if exists talent_availability_select_brand on talent.talent_availability;
--   drop trigger if exists trg_bookings_lock_identity_columns on talent.bookings;
--   drop function if exists talent.lock_booking_identity_columns();
--   -- (re-add prior agency_talent_insert_editor / talent_availability_insert_owner /
--   --  talent_availability_update_owner / booking_status_history_insert_message
--   --  policy bodies without the added checks)

-- ---------------------------------------------------------------------------
-- Codacy HIGH — talent_profiles.profile_id `on delete set null` would nullify
-- the FK while agency_org_id stays null too, violating
-- talent_profile_exactly_one_owner and blocking auth.users deletion for every
-- independent (non-agency) talent profile. `on delete cascade` is correct:
-- an independent profile has no owner left once its one auth.users row is
-- gone. Agency-owned profiles (profile_id already null) are unaffected.
-- ---------------------------------------------------------------------------
alter table talent.talent_profiles
  drop constraint talent_profiles_profile_id_fkey,
  add constraint talent_profiles_profile_id_fkey
    foreign key (profile_id) references auth.users(id) on delete cascade;

-- ---------------------------------------------------------------------------
-- Codacy MEDIUM + optibot — talent_profiles_public had two grants: line 101's
-- `authenticated` only, then line 471's broader `authenticated, anon` (a
-- `grant select on all tables in schema talent` sweep that over-included the
-- view). Currently inert (talent isn't PostgREST-exposed) but live in the
-- database and wider than the documented "authenticated brand" intent —
-- exposing measurements/ai_tags/bio/verification_status the moment the
-- schema is ever added to config.toml. Revoke just the anon grant; the
-- authenticated grant from line 101 stands.
-- ---------------------------------------------------------------------------
revoke select on talent.talent_profiles_public from anon;

-- ---------------------------------------------------------------------------
-- optibot [Security] + CodeRabbit (minor) — the notifications immutability
-- trigger's own error message promises "only the read column may be
-- updated" but never checked `channel` (an org member could flip
-- 'in-app' -> 'email' and re-route/force redelivery once email is wired up)
-- nor `id`/`created_at` (Codacy's low-risk hardening suggestion, folded in
-- here since it's the same trigger body). `create or replace` keeps the
-- existing trigger binding — no need to touch the trigger itself.
-- ---------------------------------------------------------------------------
create or replace function public.notifications_lock_immutable_columns()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.id is distinct from old.id
     or new.created_at is distinct from old.created_at
     or new.channel is distinct from old.channel
     or new.kind is distinct from old.kind
     or new.payload is distinct from old.payload
     or new.brand_org_id is distinct from old.brand_org_id
     or new.talent_profile_id is distinct from old.talent_profile_id
     or new.agency_org_id is distinct from old.agency_org_id
  then
    raise exception 'notifications: only the read column may be updated';
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- CodeRabbit Major/Quick-win — agency_talent_insert_editor checked only that
-- the acting org has editor+ role on agency_org_id, never that the referenced
-- talent_profile_id is actually owned by that same agency. Any agency editor
-- could roster a rival agency's (or an independent's) talent.
-- ---------------------------------------------------------------------------
drop policy if exists agency_talent_insert_editor on talent.agency_talent;
create policy agency_talent_insert_editor on talent.agency_talent
  for insert to authenticated
  with check (
    public.is_org_editor_or_above(agency_org_id)
    and exists (
      select 1 from talent.talent_profiles tp
      where tp.id = talent_profile_id
        and tp.agency_org_id = agency_talent.agency_org_id
    )
  );

-- ---------------------------------------------------------------------------
-- CodeRabbit Major/Quick-win — talent_availability's own comment promises
-- brands with a live booking a narrow availability read; no such policy
-- existed (only owner/agency-member select). Scoped strictly by booking_id,
-- matching the same brand-membership pattern already used for
-- booking_status_history_select_party.
-- ---------------------------------------------------------------------------
create policy talent_availability_select_brand on talent.talent_availability
  for select to authenticated
  using (
    booking_id in (
      select id from talent.bookings where public.is_org_member(brand_org_id)
    )
  );

-- ---------------------------------------------------------------------------
-- CodeRabbit Major/Quick-win — insert/update policies restricted the status
-- value but not booking_id, so a client could (a) insert a manual row that
-- spoofs a booking_id linkage, or (b) UPDATE an existing trigger-owned
-- tentative/booked row back to available/blocked, silently releasing a hold
-- the trigger is supposed to own exclusively. `booking_id is null` closes
-- both paths — client writes are manual-only, trigger-derived rows are
-- read-only to every role but the SECURITY DEFINER trigger.
-- ---------------------------------------------------------------------------
drop policy if exists talent_availability_insert_owner on talent.talent_availability;
create policy talent_availability_insert_owner on talent.talent_availability
  for insert to authenticated
  with check (
    status in ('available', 'blocked')
    and booking_id is null
    and talent_profile_id in (
      select id from talent.talent_profiles
      where profile_id = (select auth.uid())
         or public.is_org_editor_or_above(agency_org_id)
    )
  );

drop policy if exists talent_availability_update_owner on talent.talent_availability;
create policy talent_availability_update_owner on talent.talent_availability
  for update to authenticated
  using (
    status in ('available', 'blocked')
    and booking_id is null
    and talent_profile_id in (
      select id from talent.talent_profiles
      where profile_id = (select auth.uid())
         or public.is_org_editor_or_above(agency_org_id)
    )
  )
  with check (
    status in ('available', 'blocked')
    and booking_id is null
    and talent_profile_id in (
      select id from talent.talent_profiles
      where profile_id = (select auth.uid())
         or public.is_org_editor_or_above(agency_org_id)
    )
  );

-- ---------------------------------------------------------------------------
-- optibot [Bug] — the status-change trigger only fired on `update of status`,
-- so rescheduling a booking (date_start/date_end changed, status unchanged)
-- never refreshed the derived talent_availability hold — the calendar kept
-- showing the OLD date range as tentative/booked. The insert...on conflict...
-- do update logic already refreshes date_range correctly from new.date_start/
-- new.date_end whenever the trigger fires; the only gap was the trigger not
-- firing at all on a date-only change. Widening the trigger's column list
-- plus the early-return guard closes it — no change to the upsert body itself.
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

drop trigger if exists trg_bookings_log_status_change on talent.bookings;
create trigger trg_bookings_log_status_change
  after insert or update of status, date_start, date_end on talent.bookings
  for each row execute function talent.log_booking_status_change();

-- ---------------------------------------------------------------------------
-- CodeRabbit Major/Heavy-lift — bookings_update_party only ever blocked
-- status='confirmed'; a party could still rewrite which brand/talent/shoot
-- the booking even refers to. Locking the true identity/attribution columns
-- via a BEFORE trigger closes the reassignment risk without redesigning the
-- lifecycle. Deliberately scoped down from CodeRabbit's full suggestion:
-- dates/rate/message/status/approved_by/cancelled_by stay mutable — they're
-- the legitimate quote/counter/reschedule/decline/cancel flow the schema's
-- own comments describe, and a full status-transition state machine is a
-- separate, larger design task (CodeRabbit's own "Heavy lift" label) —
-- tracked as a follow-up, not built here.
-- ---------------------------------------------------------------------------
create or replace function talent.lock_booking_identity_columns()
returns trigger
language plpgsql
set search_path = talent, public
as $$
begin
  if new.brand_org_id is distinct from old.brand_org_id
     or new.talent_profile_id is distinct from old.talent_profile_id
     or new.shoot_id is distinct from old.shoot_id
     or new.requested_by is distinct from old.requested_by
  then
    raise exception 'bookings: brand_org_id, talent_profile_id, shoot_id, and requested_by are immutable after creation';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_bookings_lock_identity_columns on talent.bookings;
create trigger trg_bookings_lock_identity_columns
  before update on talent.bookings
  for each row execute function talent.lock_booking_identity_columns();

-- ---------------------------------------------------------------------------
-- CodeRabbit Major/Quick-win — booking_status_history_insert_message allowed
-- a client to set arbitrary actor_id/from_status/to_status on a 'message'
-- row, weakening the audit trail. Require self-attribution and null
-- status fields for client-authored messages (status_change/system_expired
-- rows remain trigger-only, unaffected by this policy).
-- ---------------------------------------------------------------------------
drop policy if exists booking_status_history_insert_message on talent.booking_status_history;
create policy booking_status_history_insert_message on talent.booking_status_history
  for insert to authenticated
  with check (
    event_type = 'message'
    and actor_id = (select auth.uid())
    and from_status is null
    and to_status is null
    and message is not null
    and booking_id in (
      select id from talent.bookings
      where public.is_org_member(brand_org_id)
         or talent_profile_id in (
           select id from talent.talent_profiles
           where profile_id = (select auth.uid())
              or public.is_org_editor_or_above(agency_org_id)
         )
    )
  );
