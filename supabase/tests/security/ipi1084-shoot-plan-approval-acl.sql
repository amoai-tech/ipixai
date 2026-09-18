-- IPI-1084 · APPROVAL-001 — exact-revision ShootPlan approval record security regression.
-- Runner: .github/workflows/ci.yml job supabase-fresh-replay
--         (psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -v ON_ERROR_STOP=1
--          -f supabase/tests/security/ipi1084-shoot-plan-approval-acl.sql)
--
-- Runs against the real Postgres semantics of the fresh replay chain: two orgs, an
-- owner/editor, a viewer, and a cross-org editor, exercising the actual RLS policies,
-- grants and RPC bodies rather than matching SQL text.
--
-- Observable cases (mirrored statically in tests/approval-001.test.ts so a missing
-- suite fails fast):
--   * the approval table is org-scoped read-only for authenticated and denies anon
--   * service_role does not write the table directly; only the RPCs do
--   * staging is service_role-only, deciding/reading is authenticated-only
--   * service_role can run the bounded durable proof read, and that read returns
--     the identity + recomputed hashMatches + isCurrent and nothing else
--   * service_role can neither execute nor invoke the human decision RPC
--   * the revision identity (brand/workflow_run/revision/plan/plan_hash) is immutable
--   * a status-only transition still succeeds
--   * only the newest staged revision may be decided (SUPERSEDED_REVISION otherwise)
--   * an Org A owner/editor can decide; an Org A viewer cannot
--   * an Org B owner/editor cannot read or decide Org A's approval (cross-tenant)
--   * authenticated cannot insert plan approvals directly
--   * decide() fails closed with UNAUTHENTICATED when there is no actor
--   * the whole lifecycle writes ZERO rows to shoot.shoots / shoot.shot_list /
--     shoot.shoot_deliverables

begin;

do $$
declare
  approval regclass := to_regclass('shoot.shoot_plan_approvals');
  policy_count int;
  visible_rows int;
  insert_denied boolean := false;
  raised boolean := false;
  status_ok boolean := false;
  unauth_code text;
  service_decision_denied boolean := false;
  shoot_rows_before bigint;
  shoot_rows_after bigint;
  proof jsonb;

  editor_a uuid := '00000000-0000-4000-8000-000000000001';
  viewer_a uuid := '00000000-0000-4000-8000-000000000002';
  editor_b uuid := '00000000-0000-4000-8000-000000000003';
  org_a uuid := '00000000-0000-4000-8000-00000000000a';
  org_b uuid := '00000000-0000-4000-8000-00000000000b';
  brand_a uuid := '00000000-0000-4000-8000-00000000000c';

  staged jsonb;
  rev1_id uuid;
  rev1_hash text;
  rev2_id uuid;
  rev2_hash text;
  decision jsonb;
  read_back jsonb;
begin
  if approval is null then
    raise exception 'IPI-1084: shoot.shoot_plan_approvals is missing';
  end if;

  -- Count every Shoot application row the review lifecycle must never create.
  -- Taken before any approval activity and compared again at the end.
  select (
    (select count(*) from shoot.shoots)
    + (select count(*) from shoot.shot_list)
    + (select count(*) from shoot.shoot_deliverables)
  ) into shoot_rows_before;

  -- ---- RLS + least privilege on the table ---------------------------------
  if not (select relrowsecurity from pg_class where oid = approval) then
    raise exception 'IPI-1084: shoot_plan_approvals must have RLS enabled';
  end if;

  select count(*) into policy_count from pg_policies
  where schemaname = 'shoot' and tablename = 'shoot_plan_approvals';
  if policy_count <> 1 then
    raise exception 'IPI-1084: expected exactly one org-scoped select policy, found %', policy_count;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'shoot'
      and tablename = 'shoot_plan_approvals'
      and policyname = 'shoot_plan_approvals_select_org'
      and cmd = 'SELECT'
      and permissive = 'PERMISSIVE'
      and qual like '%is_org_member%'
  ) then
    raise exception 'IPI-1084: select policy must be org-scoped through public.is_org_member';
  end if;

  if has_table_privilege('anon', approval, 'select')
     or has_table_privilege('anon', approval, 'insert')
     or has_table_privilege('anon', approval, 'update')
     or has_table_privilege('anon', approval, 'delete') then
    raise exception 'IPI-1084: anon must have no privileges on shoot_plan_approvals';
  end if;

  if not has_table_privilege('authenticated', approval, 'select') then
    raise exception 'IPI-1084: authenticated must have SELECT on shoot_plan_approvals';
  end if;
  if has_table_privilege('authenticated', approval, 'insert')
     or has_table_privilege('authenticated', approval, 'update')
     or has_table_privilege('authenticated', approval, 'delete') then
    raise exception 'IPI-1084: authenticated must not write shoot_plan_approvals directly';
  end if;
  if has_table_privilege('service_role', approval, 'insert')
     or has_table_privilege('service_role', approval, 'update')
     or has_table_privilege('service_role', approval, 'delete') then
    raise exception 'IPI-1084: service_role must not write shoot_plan_approvals directly (RPC only)';
  end if;

  -- ---- the RPC surface is role-separated ----------------------------------
  if to_regprocedure('public.stage_shoot_plan_revision(uuid, text, jsonb, uuid, text, timestamptz)') is null
     or to_regprocedure('public.decide_shoot_plan_revision(uuid, integer, text, text, text, text)') is null
     or to_regprocedure('public.get_shoot_plan_approval(uuid)') is null
     or to_regprocedure('public.get_shoot_plan_approval_proof(uuid)') is null then
    raise exception 'IPI-1084: the approval RPC surface is incomplete';
  end if;

  if has_function_privilege('anon', 'public.stage_shoot_plan_revision(uuid, text, jsonb, uuid, text, timestamptz)', 'execute')
     or has_function_privilege('anon', 'public.decide_shoot_plan_revision(uuid, integer, text, text, text, text)', 'execute')
     or has_function_privilege('anon', 'public.get_shoot_plan_approval(uuid)', 'execute')
     or has_function_privilege('anon', 'public.get_shoot_plan_approval_proof(uuid)', 'execute') then
    raise exception 'IPI-1084: anon must not EXECUTE the approval RPCs';
  end if;
  if has_function_privilege('authenticated', 'public.stage_shoot_plan_revision(uuid, text, jsonb, uuid, text, timestamptz)', 'execute') then
    raise exception 'IPI-1084: only service_role may stage a plan revision';
  end if;
  if not has_function_privilege('service_role', 'public.stage_shoot_plan_revision(uuid, text, jsonb, uuid, text, timestamptz)', 'execute') then
    raise exception 'IPI-1084: service_role must EXECUTE the staging RPC';
  end if;
  if not has_function_privilege('authenticated', 'public.decide_shoot_plan_revision(uuid, integer, text, text, text, text)', 'execute')
     or not has_function_privilege('authenticated', 'public.get_shoot_plan_approval(uuid)', 'execute') then
    raise exception 'IPI-1084: authenticated must EXECUTE the decide and read RPCs';
  end if;

  -- ---- the service-side durable proof read is narrow and real --------------
  -- service_role has no session, so the org-scoped read (which checks auth.uid())
  -- can never serve the workflow; it must not hold EXECUTE at all.
  if has_function_privilege('service_role', 'public.get_shoot_plan_approval(uuid)', 'execute') then
    raise exception 'IPI-1084: service_role must not EXECUTE the session-scoped operator read';
  end if;
  if not has_function_privilege('service_role', 'public.get_shoot_plan_approval_proof(uuid)', 'execute') then
    raise exception 'IPI-1084: service_role must EXECUTE the durable proof read';
  end if;
  if has_function_privilege('authenticated', 'public.get_shoot_plan_approval_proof(uuid)', 'execute') then
    raise exception 'IPI-1084: the service proof read must not be reachable by authenticated';
  end if;
  -- The human decision is never a service-role action.
  if has_function_privilege('service_role', 'public.decide_shoot_plan_revision(uuid, integer, text, text, text, text)', 'execute') then
    raise exception 'IPI-1084: service_role must not EXECUTE the human decision RPC';
  end if;

  -- SECURITY DEFINER + pinned empty search_path are load-bearing on all four.
  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('stage_shoot_plan_revision', 'decide_shoot_plan_revision', 'get_shoot_plan_approval', 'get_shoot_plan_approval_proof')
      and not p.prosecdef
  ) then
    raise exception 'IPI-1084: approval RPCs must stay SECURITY DEFINER';
  end if;
  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('stage_shoot_plan_revision', 'decide_shoot_plan_revision', 'get_shoot_plan_approval', 'get_shoot_plan_approval_proof')
      and not exists (
        select 1 from unnest(coalesce(p.proconfig, '{}')) cfg where cfg = 'search_path=""'
      )
  ) then
    raise exception 'IPI-1084: approval RPCs must pin the exact empty search_path';
  end if;

  -- ---- schema invariants --------------------------------------------------
  if not exists (
    select 1 from pg_constraint
    where conrelid = approval and contype = 'u'
      and pg_get_constraintdef(oid) = 'UNIQUE (workflow_run_id, revision)'
  ) then
    raise exception 'IPI-1084: (workflow_run_id, revision) must be unique (the compare-and-set guard)';
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = approval and contype = 'c'
      and pg_get_constraintdef(oid) like '%status%'
      and pg_get_constraintdef(oid) like '%changes_requested%'
  ) then
    raise exception 'IPI-1084: status vocabulary CHECK is missing';
  end if;

  if not exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'shoot'
      and c.relname = 'shoot_plan_approvals'
      and t.tgname = 'trg_shoot_plan_approvals_lock_identity'
      and not t.tgisinternal
      and t.tgenabled <> 'D'
  ) then
    raise exception 'IPI-1084: the revision identity lock trigger must exist and be enabled';
  end if;

  -- ---- deterministic fixtures: Org A (owner + viewer) and Org B (owner) ----
  insert into auth.users (id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values
    (editor_a, 'authenticated', 'authenticated', 'ipi1084-editor-a@ipix.test', now(), '{"provider":"email"}'::jsonb, '{}'::jsonb, now(), now()),
    (viewer_a, 'authenticated', 'authenticated', 'ipi1084-viewer-a@ipix.test', now(), '{"provider":"email"}'::jsonb, '{}'::jsonb, now(), now()),
    (editor_b, 'authenticated', 'authenticated', 'ipi1084-editor-b@ipix.test', now(), '{"provider":"email"}'::jsonb, '{}'::jsonb, now(), now());

  insert into public.organizations (id, name, slug, type, owner_id)
  values
    (org_a, 'IPI-1084 Org A', 'ipi1084-org-a', 'brand_owner', editor_a),
    (org_b, 'IPI-1084 Org B', 'ipi1084-org-b', 'brand_owner', editor_b);

  -- Organization creation may already bootstrap an owner membership, so make the
  -- fixture idempotent rather than assuming an empty org_members table.
  insert into public.org_members (org_id, user_id, role)
  values
    (org_a, editor_a, 'owner'),
    (org_a, viewer_a, 'viewer'),
    (org_b, editor_b, 'owner')
  on conflict (org_id, user_id) do update set role = excluded.role;

  insert into public.brands (id, user_id, name, org_id)
  values (brand_a, editor_a, 'IPI-1084 Brand A', org_a);

  -- ---- staging is server-owned and revision-monotonic ---------------------
  staged := public.stage_shoot_plan_revision(brand_a, 'ipi1084-acl-run', '{"revision":1}'::jsonb, editor_a, 'ipi1084-thread', null);
  if (staged ->> 'ok')::boolean is not true then
    raise exception 'IPI-1084: staging revision 1 must succeed, got %', staged;
  end if;
  rev1_id := (staged ->> 'approvalId')::uuid;
  rev1_hash := staged ->> 'planHash';

  staged := public.stage_shoot_plan_revision(brand_a, 'ipi1084-acl-run', '{"revision":2}'::jsonb, editor_a, 'ipi1084-thread', null);
  if (staged ->> 'ok')::boolean is not true or (staged ->> 'revision')::int <> 2 then
    raise exception 'IPI-1084: staging revision 2 must succeed and increment the revision, got %', staged;
  end if;
  rev2_id := (staged ->> 'approvalId')::uuid;
  rev2_hash := staged ->> 'planHash';

  if rev1_hash = rev2_hash then
    raise exception 'IPI-1084: distinct plan bytes must produce distinct hashes';
  end if;

  -- ---- behavioural: identity immutable, status transition allowed ----------
  begin
    update shoot.shoot_plan_approvals set plan_hash = repeat('b', 64) where id = rev2_id;
  exception when check_violation then
    raised := true;
  end;
  if not raised then
    raise exception 'IPI-1084: rewriting plan_hash must be blocked by the identity lock trigger';
  end if;

  raised := false;
  begin
    update shoot.shoot_plan_approvals set plan = '{"revision":"tampered"}'::jsonb where id = rev2_id;
  exception when check_violation then
    raised := true;
  end;
  if not raised then
    raise exception 'IPI-1084: rewriting the approved plan must be blocked by the identity lock trigger';
  end if;

  raised := false;
  begin
    update shoot.shoot_plan_approvals set revision = 99 where id = rev2_id;
  exception when check_violation then
    raised := true;
  end;
  if not raised then
    raise exception 'IPI-1084: rewriting the revision number must be blocked by the identity lock trigger';
  end if;

  -- ---- behavioural: Org A owner/editor decides, viewer cannot -------------
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', editor_a), true);

  select count(*) into visible_rows from shoot.shoot_plan_approvals;
  if visible_rows <> 2 then
    raise exception 'IPI-1084: the Org A owner must see both revisions, saw %', visible_rows;
  end if;

  -- A superseded revision can never be decided, even by an authorised operator.
  decision := public.decide_shoot_plan_revision(rev1_id, 1, rev1_hash, 'approved', 'ipi1084-acl-rev1', null);
  if decision ->> 'code' is distinct from 'SUPERSEDED_REVISION' then
    raise exception 'IPI-1084: deciding a superseded revision must fail closed, got %', decision;
  end if;

  decision := public.decide_shoot_plan_revision(rev2_id, 2, rev2_hash, 'approved', 'ipi1084-acl-rev2', 'ship it');
  if (decision ->> 'ok')::boolean is not true or decision ->> 'status' is distinct from 'approved' then
    raise exception 'IPI-1084: the Org A owner must be able to approve the current revision, got %', decision;
  end if;

  -- Same request again: idempotent replay for the same actor.
  decision := public.decide_shoot_plan_revision(rev2_id, 2, rev2_hash, 'approved', 'ipi1084-acl-rev2', 'ship it');
  if (decision ->> 'replayed')::boolean is not true then
    raise exception 'IPI-1084: a repeated identical decision must replay, got %', decision;
  end if;

  read_back := public.get_shoot_plan_approval(rev2_id);
  if (read_back ->> 'hashMatches')::boolean is not true
     or (read_back ->> 'isCurrent')::boolean is not true
     or read_back ->> 'status' is distinct from 'approved' then
    raise exception 'IPI-1084: the approved revision must read back with a recomputed hash and isCurrent, got %', read_back;
  end if;

  -- The viewer is a member (may read) but is not an approver.
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', viewer_a), true);
  select count(*) into visible_rows from shoot.shoot_plan_approvals;
  if visible_rows <> 2 then
    raise exception 'IPI-1084: the Org A viewer may read the brand approvals, saw %', visible_rows;
  end if;
  decision := public.decide_shoot_plan_revision(rev1_id, 1, rev1_hash, 'rejected', 'ipi1084-acl-viewer', null);
  if decision ->> 'code' is distinct from 'FORBIDDEN' then
    raise exception 'IPI-1084: a viewer must not be able to decide, got %', decision;
  end if;

  -- ---- behavioural: cross-org isolation -----------------------------------
  perform set_config('request.jwt.claims', format('{"sub":"%s"}', editor_b), true);
  select count(*) into visible_rows from shoot.shoot_plan_approvals;
  if visible_rows <> 0 then
    raise exception 'IPI-1084: an Org B operator must see no Org A approvals, saw %', visible_rows;
  end if;
  decision := public.decide_shoot_plan_revision(rev2_id, 2, rev2_hash, 'rejected', 'ipi1084-acl-crossorg', null);
  if decision ->> 'code' is distinct from 'FORBIDDEN' then
    raise exception 'IPI-1084: an Org B operator must not decide Org A approvals, got %', decision;
  end if;
  read_back := public.get_shoot_plan_approval(rev2_id);
  if read_back ->> 'code' is distinct from 'FORBIDDEN' then
    raise exception 'IPI-1084: an Org B operator must not read Org A approvals, got %', read_back;
  end if;

  -- ---- behavioural: no actor, no direct insert ----------------------------
  perform set_config('request.jwt.claims', '{}', true);
  decision := public.decide_shoot_plan_revision(rev2_id, 2, rev2_hash, 'approved', 'ipi1084-acl-anon', null);
  if decision ->> 'code' is distinct from 'UNAUTHENTICATED' then
    raise exception 'IPI-1084: decide() must fail closed without an actor, got %', decision;
  end if;

  begin
    insert into shoot.shoot_plan_approvals (brand_id, workflow_run_id, revision, plan, plan_hash)
    values (brand_a, 'ipi1084-acl-run', 3, '{}'::jsonb, repeat('c', 64));
  exception when insufficient_privilege then
    insert_denied := true;
  end;
  if not insert_denied then
    raise exception 'IPI-1084: authenticated must not insert plan approvals directly';
  end if;

  -- A status-only transition stays inside the allowed write surface.
  perform set_config('role', 'postgres', true);
  update shoot.shoot_plan_approvals set status = 'pending' where id = rev2_id;
  select status = 'pending' into status_ok from shoot.shoot_plan_approvals where id = rev2_id;
  if status_ok is distinct from true then
    raise exception 'IPI-1084: a status-only transition must remain allowed';
  end if;
  update shoot.shoot_plan_approvals set status = 'approved' where id = rev2_id;

  -- ---- behavioural: the workflow's service-side durable re-read ------------
  -- This is the exact call the suspended `awaitDecision` step makes: no session,
  -- service_role. It must succeed and prove the decision.
  perform set_config('role', 'service_role', true);
  perform set_config('request.jwt.claims', '{}', true);

  proof := public.get_shoot_plan_approval_proof(rev2_id);
  if (proof ->> 'ok')::boolean is not true then
    raise exception 'IPI-1084: the workflow service read must succeed, got %', proof;
  end if;
  if proof ->> 'approvalId' is distinct from rev2_id::text
     or proof ->> 'brandId' is distinct from brand_a::text
     or proof ->> 'workflowRunId' is distinct from 'ipi1084-acl-run'
     or (proof ->> 'revision')::int <> 2
     or proof ->> 'planHash' is distinct from rev2_hash
     or proof ->> 'status' is distinct from 'approved'
     or proof ->> 'decision' is distinct from 'approved'
     or (proof ->> 'hashMatches')::boolean is not true
     or (proof ->> 'isCurrent')::boolean is not true then
    raise exception 'IPI-1084: the workflow service read must return the identity proof, got %', proof;
  end if;
  -- Bounded: exactly the proof fields, never the plan body or a user id.
  if (select count(*) from jsonb_object_keys(proof)) <> 10 then
    raise exception 'IPI-1084: the workflow service read must be bounded to 10 fields, got %', proof;
  end if;
  if proof ? 'plan' or proof ? 'decidedBy' or proof ? 'decisionNote' or proof ? 'agentThreadId' then
    raise exception 'IPI-1084: the workflow service read must not expose plan/actor fields, got %', proof;
  end if;

  -- A superseded revision reads back as not current, so the step can fail closed.
  proof := public.get_shoot_plan_approval_proof(rev1_id);
  if (proof ->> 'isCurrent')::boolean is not false then
    raise exception 'IPI-1084: a superseded revision must not read back as current, got %', proof;
  end if;

  -- The same service_role caller must NOT be able to record a human decision.
  begin
    decision := public.decide_shoot_plan_revision(rev2_id, 2, rev2_hash, 'rejected', 'ipi1084-acl-service', null);
    service_decision_denied := false;
  exception when insufficient_privilege then
    service_decision_denied := true;
  end;
  if not service_decision_denied then
    raise exception 'IPI-1084: service_role must not be able to invoke the human decision RPC, got %', decision;
  end if;

  perform set_config('role', 'postgres', true);

  -- ---- zero Shoot application writes over the whole lifecycle --------------
  select (
    (select count(*) from shoot.shoots)
    + (select count(*) from shoot.shot_list)
    + (select count(*) from shoot.shoot_deliverables)
  ) into shoot_rows_after;
  if shoot_rows_after <> shoot_rows_before then
    raise exception 'IPI-1084: the approval lifecycle wrote Shoot data (% -> %)', shoot_rows_before, shoot_rows_after;
  end if;
end
$$;

rollback;
