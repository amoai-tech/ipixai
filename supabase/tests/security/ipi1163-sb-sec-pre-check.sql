-- IPI-1163 · SB-SEC — pre-retirement assertion: proves the seeded
-- live-drift policies actually grant the access they claim to, on all 4
-- tables, BEFORE the retirement migration runs. Without this, a broken or
-- unrealistic seed could make the post-migration "access denied" assertion
-- pass for the wrong reason (e.g. an FK violation instead of an RLS
-- denial). Runs between the seed step and the retirement migration in CI.
--
-- Deliberately does NOT use INSERT ... RETURNING for the 3 child-table
-- inserts: RETURNING reads the row back, which Postgres also gates on the
-- table's SELECT policies, not just the INSERT policy's WITH CHECK -- and
-- there is no anon SELECT policy on event_phases/event_schedules/
-- ticket_tiers (only INSERT), so RETURNING as anon would fail RLS even
-- though the INSERT itself succeeds. Verified via a plain count() in a
-- separate statement under the superuser role instead.

begin;

do $$
declare
  sentinel        uuid := '00000000-0000-0000-0000-000000000000';
  demo_event_id   uuid := gen_random_uuid();
  phase_found     boolean;
  sched_found     boolean;
  tier_found      boolean;
begin
  if not exists (select 1 from auth.users where id = sentinel) then
    raise exception 'IPI-1163 pre-check FAIL: sentinel auth.users row missing (seed did not run, or FK precondition broken)';
  end if;

  execute 'set local role anon';

  insert into public.events (id, organizer_id, title, slug, start_time)
  values (demo_event_id, sentinel, 'IPI-1163 pre-check demo event', 'ipi1163-precheck-event-' || demo_event_id, now());

  insert into public.event_phases (event_id, phase_name, phase_key, order_index)
  values (demo_event_id, 'Pre-check phase', 'precheck', 0);

  insert into public.event_schedules (event_id, title, start_time)
  values (demo_event_id, 'Pre-check schedule', now());

  insert into public.ticket_tiers (event_id, name, quantity_total)
  values (demo_event_id, 'Pre-check tier', 10);

  reset role;

  -- Existence checks, not exact counts: an events-insert trigger auto-
  -- creates its own default phases (14 of them, per IPI-1162's audit),
  -- so event_phases has more than just our one manually-inserted row.
  select exists (select 1 from public.event_phases where event_id = demo_event_id and phase_key = 'precheck') into phase_found;
  select exists (select 1 from public.event_schedules where event_id = demo_event_id and title = 'Pre-check schedule') into sched_found;
  select exists (select 1 from public.ticket_tiers where event_id = demo_event_id and name = 'Pre-check tier') into tier_found;

  if not phase_found or not sched_found or not tier_found then
    raise exception 'IPI-1163 pre-check FAIL: seeded anon insert did not actually succeed on all 4 tables (phase=%, schedule=%, tier=%)', phase_found, sched_found, tier_found;
  end if;

  raise notice 'IPI-1163 pre-check PASS: seeded live-drift access confirmed functional on events, event_phases, event_schedules, ticket_tiers';
end;
$$;

rollback;
