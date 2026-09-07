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

  -- 6) brand_scores_select_via_brand (IPI-1168, folded into this ticket)
  --    must exist, on the right relation, scoped to authenticated ONLY.
  --    The seed widens this back to PUBLIC (20260907030000 already
  --    narrowed it once during the initial replay, before this seed ran)
  --    and ci.yml re-applies that migration after seeding, so this proves
  --    the real fix, not a no-op left over from the replay.
  --
  --    Asserts the POSITIVE invariant, not a negative "if exists with a
  --    wrong role, fail" check: an exists(...)-based negative check has a
  --    false-positive hole -- if the policy were missing entirely (wrong
  --    name, wrong relation, dropped by a future edit), exists(...) is
  --    false and the check would silently pass. Requires a matching row
  --    to exist on exactly public.brand_scores with polroles exactly
  --    {authenticated} -- fails for: missing policy, PUBLIC, anon, wrong
  --    relation, authenticated-plus-extra-roles, or a renamed policy.
  if not exists (
    select 1 from pg_policy p
    where p.polrelid = 'public.brand_scores'::regclass
      and p.polname = 'brand_scores_select_via_brand'
      and p.polroles::regrole[] = array['authenticated'::regrole]
  ) then
    raise exception 'IPI-1163 FAIL: brand_scores_select_via_brand missing or not scoped exactly to authenticated on public.brand_scores';
  end if;

  -- 7) behavioral proof, not just the role-scope catalog check: the role
  --    boundary (TO authenticated) is only half the policy -- the
  --    ownership predicate (is_org_member(b.org_id)) must remain
  --    authoritative and unweakened. Real org + org_member + brand +
  --    brand_scores row: anon must see zero rows (role boundary), and an
  --    authenticated non-member of that org must ALSO see zero rows
  --    (ownership predicate) -- only an actual org member sees it.
  declare
    scores_org      uuid := gen_random_uuid();
    scores_brand    uuid := gen_random_uuid();
    scores_row_id   uuid := gen_random_uuid();
    org_member      uuid := gen_random_uuid();
    non_member      uuid := gen_random_uuid();
    visible_rows    int;
  begin
    insert into auth.users (id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
    values
      (org_member, 'authenticated', 'authenticated', 'ipi1163-member@ipix.test', now(), '{"provider":"email"}'::jsonb, '{}'::jsonb, now(), now()),
      (non_member, 'authenticated', 'authenticated', 'ipi1163-nonmember@ipix.test', now(), '{"provider":"email"}'::jsonb, '{}'::jsonb, now(), now());
    insert into public.organizations (id, name, slug, type, owner_id, plan)
    values (scores_org, 'IPI1163 Scores Org', 'ipi1163-scores-org', 'agency', org_member, 'free');
    -- organizations has an auto-owner trigger that already inserts the
    -- owner's org_members row; ON CONFLICT DO NOTHING covers both that
    -- and the case where it doesn't (repo behavior, not under test here).
    insert into public.org_members (org_id, user_id, role) values (scores_org, org_member, 'owner')
      on conflict (org_id, user_id) do nothing;
    insert into public.brands (id, user_id, org_id, name, brand_url)
    values (scores_brand, org_member, scores_org, 'IPI1163 Scores Brand', null);
    insert into public.brand_scores (id, brand_id, score_type, score)
    values (scores_row_id, scores_brand, 'ipi1163-test', 50);

    execute 'set local role anon';
    select count(*) into visible_rows from public.brand_scores where id = scores_row_id;
    reset role;
    if visible_rows <> 0 then
      raise exception 'IPI-1163 FAIL: anon can see a brand_scores row (role boundary not enforced)';
    end if;

    perform set_config('request.jwt.claim.sub', non_member::text, true);
    execute format('set local role authenticated; set local request.jwt.claims = %L', json_build_object('sub', non_member)::text);
    select count(*) into visible_rows from public.brand_scores where id = scores_row_id;
    reset role;
    if visible_rows <> 0 then
      raise exception 'IPI-1163 FAIL: authenticated non-org-member can see a brand_scores row (ownership predicate weakened or bypassed)';
    end if;

    perform set_config('request.jwt.claim.sub', org_member::text, true);
    execute format('set local role authenticated; set local request.jwt.claims = %L', json_build_object('sub', org_member)::text);
    select count(*) into visible_rows from public.brand_scores where id = scores_row_id;
    reset role;
    if visible_rows <> 1 then
      raise exception 'IPI-1163 FAIL: authenticated org member cannot see their own org''s brand_scores row (legitimate path broken)';
    end if;
  end;

  raise notice 'IPI-1163 anon demo-event policy retirement regression PASS';
end;
$$;

rollback;
