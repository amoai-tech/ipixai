-- IPI-1163 · SB-SEC — regression for the anon demo-event policy retirement.
-- Run once against the seeded live-drift state (must show anon CAN insert
-- -- proves the exploit is real) and once after applying the retirement
-- migration (must show anon CANNOT insert -- proves it's closed).

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

  -- 1) anon attempting to insert a demo event via the sentinel organizer_id.
  allowed := false;
  begin
    execute 'set local role anon';
    insert into public.events (id, organizer_id, title, slug, start_time)
    values (demo_event_id, sentinel, 'IPI-1163 demo event', 'ipi1163-demo-event-' || demo_event_id, now());
    allowed := true;
  exception when others then
    allowed := false;
  end;
  reset role;
  if allowed then
    raise exception 'IPI-1163 FAIL: anon inserted a demo event via the sentinel organizer_id (retirement migration not applied or not effective)';
  end if;

  -- 2) authenticated organizer inserting their own event -> must always be
  --    allowed, before and after retirement (unaffected legitimate path).
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
  --    own auth.uid()) -> must be denied after retirement.
  allowed := false;
  begin
    execute format('set local role authenticated; set local request.jwt.claims = %L', json_build_object('sub', organizer)::text);
    insert into public.events (id, organizer_id, title, slug, start_time)
    values (gen_random_uuid(), sentinel, 'IPI-1163 bypass attempt', 'ipi1163-bypass-' || gen_random_uuid(), now());
    allowed := true;
  exception when others then
    allowed := false;
  end;
  reset role;
  if allowed then
    raise exception 'IPI-1163 FAIL: authenticated sentinel bypass on organizers-can-insert-events still works (retirement migration not applied or not effective)';
  end if;

  raise notice 'IPI-1163 anon demo-event policy retirement regression PASS';
end;
$$;

rollback;
