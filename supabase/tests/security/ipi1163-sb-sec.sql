-- IPI-1163 · SB-SEC — regression for the anon demo-event policy retirement.
-- Run after the retirement migration (see ipi1163-sb-sec-pre-check.sql for
-- the assertion that runs before it, proving the seeded access was real).
-- Must show anon/authenticated-sentinel access is denied on all 4 tables,
-- while the legitimate authenticated own-event path is unaffected.

begin;

do $$
declare
  organizer      uuid := gen_random_uuid();
  sentinel       uuid := '00000000-0000-0000-0000-000000000000';
  demo_event_id  uuid := gen_random_uuid();
  real_event_id  uuid;
  allowed        boolean;
begin
  insert into auth.users (id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values (organizer, 'authenticated', 'authenticated', 'ipi1163-organizer@ipix.test', now(), '{"provider":"email"}'::jsonb, '{}'::jsonb, now(), now());

  -- The seed inserts an auth.users row for the sentinel id specifically so
  -- the FK on events.organizer_id doesn't mask RLS behavior. Assert it's
  -- actually there before relying on that -- otherwise a missing seed step
  -- would make case 1 below "pass" via an FK violation, not an RLS denial.
  if not exists (select 1 from auth.users where id = sentinel) then
    raise exception 'IPI-1163 FAIL: sentinel auth.users row missing (seed did not run)';
  end if;

  -- 1) anon attempting to insert a demo event via the sentinel organizer_id
  --    -> must be denied specifically by RLS (42501 insufficient_privilege),
  --    not by some unrelated error masquerading as a pass.
  allowed := false;
  begin
    execute 'set local role anon';
    insert into public.events (id, organizer_id, title, slug, start_time)
    values (demo_event_id, sentinel, 'IPI-1163 demo event', 'ipi1163-demo-event-' || demo_event_id, now());
    allowed := true;
  exception
    when insufficient_privilege then
      allowed := false;
  end;
  reset role;
  if allowed then
    raise exception 'IPI-1163 FAIL: anon inserted a demo event via the sentinel organizer_id (retirement migration not applied or not effective)';
  end if;

  -- 2) authenticated organizer inserting their own event -> must always be
  --    allowed, before and after retirement (unaffected legitimate path).
  --    Set both the direct per-claim GUC and the JSON blob auth.uid() reads
  --    (coalesce(request.jwt.claim.sub, request.jwt.claims->>'sub')) so this
  --    doesn't silently depend on which one it happens to check first.
  perform set_config('request.jwt.claim.sub', organizer::text, true);
  execute format('set local role authenticated; set local request.jwt.claims = %L', json_build_object('sub', organizer)::text);
  insert into public.events (id, organizer_id, title, slug, start_time)
  values (gen_random_uuid(), organizer, 'IPI-1163 real event', 'ipi1163-real-event-' || gen_random_uuid(), now())
  returning id into real_event_id;
  reset role;
  if real_event_id is null then
    raise exception 'IPI-1163 FAIL: authenticated organizer could not insert their own event (legitimate path broken)';
  end if;

  -- 3) authenticated user attempting the sentinel bypass on
  --    "organizers can insert events" (organizer_id = sentinel, not their
  --    own auth.uid()) -> must be denied after retirement, specifically by RLS.
  allowed := false;
  begin
    perform set_config('request.jwt.claim.sub', organizer::text, true);
    execute format('set local role authenticated; set local request.jwt.claims = %L', json_build_object('sub', organizer)::text);
    insert into public.events (id, organizer_id, title, slug, start_time)
    values (gen_random_uuid(), sentinel, 'IPI-1163 bypass attempt', 'ipi1163-bypass-' || gen_random_uuid(), now());
    allowed := true;
  exception
    when insufficient_privilege then
      allowed := false;
  end;
  reset role;
  if allowed then
    raise exception 'IPI-1163 FAIL: authenticated sentinel bypass on organizers-can-insert-events still works (retirement migration not applied or not effective)';
  end if;

  -- 3b) event_phases_insert's own authenticated-side sentinel bypass:
  --     catalog-level check, not behavioral. Confirmed empirically while
  --     writing this test: this branch is ALREADY unreachable via a real
  --     authenticated call regardless of the fix, because its subquery
  --     against events is itself gated by events' own SELECT RLS
  --     (events_select), and an authenticated non-owner can't see a
  --     sentinel-owned, unpublished event at all -- so a behavioral
  --     before/after test can't distinguish "sentinel branch removed"
  --     from "sentinel branch present but its subquery sees nothing
  --     anyway" (same class of unreachable-behavior gap as IPI-1167's
  --     old.id/new.id fix -- see that migration's own comment). Assert
  --     directly on the installed policy expression instead.
  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'event_phases' and policyname = 'event_phases_insert'
      and with_check like '%' || sentinel::text || '%'
  ) then
    raise exception 'IPI-1163 FAIL: event_phases_insert still references the sentinel organizer_id (retirement migration not applied or not effective)';
  end if;

  -- 4) anon inserting into the 3 child tables, referencing the legitimate
  --    real_event_id from case 2 (so a denial here can only be the dropped
  --    anon INSERT policy, not an FK violation on a nonexistent event) ->
  --    all 3 must now be denied, specifically by RLS.
  allowed := false;
  begin
    execute 'set local role anon';
    insert into public.event_phases (event_id, phase_name, phase_key, order_index)
    values (real_event_id, 'IPI-1163 bypass phase', 'ipi1163-bypass', 0);
    allowed := true;
  exception
    when insufficient_privilege then
      allowed := false;
  end;
  reset role;
  if allowed then
    raise exception 'IPI-1163 FAIL: anon inserted into event_phases (retirement migration not applied or not effective)';
  end if;

  allowed := false;
  begin
    execute 'set local role anon';
    insert into public.event_schedules (event_id, title, start_time)
    values (real_event_id, 'IPI-1163 bypass schedule', now());
    allowed := true;
  exception
    when insufficient_privilege then
      allowed := false;
  end;
  reset role;
  if allowed then
    raise exception 'IPI-1163 FAIL: anon inserted into event_schedules (retirement migration not applied or not effective)';
  end if;

  allowed := false;
  begin
    execute 'set local role anon';
    insert into public.ticket_tiers (event_id, name, quantity_total)
    values (real_event_id, 'IPI-1163 bypass tier', 10);
    allowed := true;
  exception
    when insufficient_privilege then
      allowed := false;
  end;
  reset role;
  if allowed then
    raise exception 'IPI-1163 FAIL: anon inserted into ticket_tiers (retirement migration not applied or not effective)';
  end if;

  -- 5) least-privilege: anon's excess table-level INSERT/UPDATE/DELETE
  --    grants must be gone too, not just the policies (20260907040000).
  --    SELECT must remain (events_select_anon and the 2 published-only
  --    read policies are intentionally kept).
  if has_table_privilege('anon', 'public.events', 'insert')
     or has_table_privilege('anon', 'public.event_phases', 'insert')
     or has_table_privilege('anon', 'public.event_schedules', 'insert')
     or has_table_privilege('anon', 'public.ticket_tiers', 'insert')
     or has_table_privilege('anon', 'public.brand_scores', 'insert') then
    raise exception 'IPI-1163 FAIL: anon still holds an INSERT grant on one of the 5 tables (grant revoke migration not applied or not effective)';
  end if;
  if not has_table_privilege('anon', 'public.events', 'select') then
    raise exception 'IPI-1163 FAIL: anon lost SELECT on events (should be retained for events_select_anon)';
  end if;

  raise notice 'IPI-1163 anon demo-event policy retirement regression PASS';
end;
$$;

rollback;
