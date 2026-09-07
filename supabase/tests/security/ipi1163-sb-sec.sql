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

  -- 4b) independently prove the RLS policies themselves are gone, not just
  --     that INSERT fails. Once 20260907040000 revokes anon's table-level
  --     INSERT grant, an INSERT fails on the GRANT layer alone even if one
  --     of these 4 policies accidentally survived retirement -- the
  --     behavioral denials in case 1/4 above can't distinguish "policy
  --     removed" from "policy still there but grant revoked underneath
  --     it". Assert directly on pg_policy, relation-qualified so a
  --     same-named policy on the wrong table can't produce a false pass.
  if exists (
    select 1 from pg_policy
    where (polrelid = 'public.events'::regclass and polname = 'anon can insert demo events')
       or (polrelid = 'public.event_phases'::regclass and polname = 'anon can insert demo event phases')
       or (polrelid = 'public.event_schedules'::regclass and polname = 'anon can insert demo event schedules')
       or (polrelid = 'public.ticket_tiers'::regclass and polname = 'anon can insert demo ticket tiers')
  ) then
    raise exception 'IPI-1163 FAIL: a retired anonymous INSERT policy still exists on its relation (RLS retirement incomplete, independent of the ACL revoke)';
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
  --    authoritative and unweakened. Real Org A + Org B, each with their
  --    own member: anon sees zero rows (role boundary), an authenticated
  --    user with NO org membership sees zero rows, and -- the real
  --    cross-tenant case, not just "has no org at all" -- an authenticated
  --    Org B MEMBER also sees zero rows of Org A's data. Only Org A's own
  --    member sees it.
  declare
    org_a           uuid := gen_random_uuid();
    org_b           uuid := gen_random_uuid();
    scores_brand    uuid := gen_random_uuid();
    scores_row_id   uuid := gen_random_uuid();
    org_a_member    uuid := gen_random_uuid();
    org_b_member    uuid := gen_random_uuid();
    non_member      uuid := gen_random_uuid();
    visible_rows    int;
  begin
    insert into auth.users (id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
    values
      (org_a_member, 'authenticated', 'authenticated', 'ipi1163-orga-member@ipix.test', now(), '{"provider":"email"}'::jsonb, '{}'::jsonb, now(), now()),
      (org_b_member, 'authenticated', 'authenticated', 'ipi1163-orgb-member@ipix.test', now(), '{"provider":"email"}'::jsonb, '{}'::jsonb, now(), now()),
      (non_member, 'authenticated', 'authenticated', 'ipi1163-nonmember@ipix.test', now(), '{"provider":"email"}'::jsonb, '{}'::jsonb, now(), now());
    insert into public.organizations (id, name, slug, type, owner_id, plan)
    values
      (org_a, 'IPI1163 Org A', 'ipi1163-org-a', 'agency', org_a_member, 'free'),
      (org_b, 'IPI1163 Org B', 'ipi1163-org-b', 'agency', org_b_member, 'free');
    -- organizations has an auto-owner trigger that already inserts the
    -- owner's org_members row; ON CONFLICT DO NOTHING covers both that
    -- and the case where it doesn't (repo behavior, not under test here).
    insert into public.org_members (org_id, user_id, role) values
      (org_a, org_a_member, 'owner'),
      (org_b, org_b_member, 'owner')
      on conflict (org_id, user_id) do nothing;
    insert into public.brands (id, user_id, org_id, name, brand_url)
    values (scores_brand, org_a_member, org_a, 'IPI1163 Org A Brand', null);
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

    -- The real cross-tenant case: org_b_member IS a valid member of a
    -- real org (Org B) -- distinct from "has no org at all" above -- and
    -- must still see zero rows of Org A's brand_scores.
    perform set_config('request.jwt.claim.sub', org_b_member::text, true);
    execute format('set local role authenticated; set local request.jwt.claims = %L', json_build_object('sub', org_b_member)::text);
    select count(*) into visible_rows from public.brand_scores where id = scores_row_id;
    reset role;
    if visible_rows <> 0 then
      raise exception 'IPI-1163 FAIL: an authenticated Org B member can see Org A''s brand_scores row (cross-tenant isolation broken)';
    end if;

    perform set_config('request.jwt.claim.sub', org_a_member::text, true);
    execute format('set local role authenticated; set local request.jwt.claims = %L', json_build_object('sub', org_a_member)::text);
    select count(*) into visible_rows from public.brand_scores where id = scores_row_id;
    reset role;
    if visible_rows <> 1 then
      raise exception 'IPI-1163 FAIL: authenticated Org A member cannot see their own org''s brand_scores row (legitimate path broken)';
    end if;
  end;

  raise notice 'IPI-1163 anon demo-event policy retirement regression PASS';
end;
$$;

rollback;
