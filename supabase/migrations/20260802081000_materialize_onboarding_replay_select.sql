-- IPI-916 · ONB2-DB-001d — Fix materialize replay blocked by FOR UPDATE RLS
--
-- Postgres applies UPDATE RLS to SELECT … FOR UPDATE. onboarding_sessions_update_own
-- only allows status=draft (or app.onboarding_materializing=on). After the first
-- materialize, a retry / concurrent loser cannot see the row → P0002, so the
-- replay branch never runs.
--
-- Fix: plain SELECT (SELECT RLS) first for replay; FOR UPDATE only while draft.
-- Do not widen the UPDATE policy (keeps IPI-904 column-guard direction intact).
--
-- Preserves IPI-903 · ONB2-INT-001b1 — current_screen = 12 on materialize +
-- replay-heal for rows stuck at < 12 (draft RLS blocks client screen writes
-- after materialize).
--
-- Rollback: restore function body from
-- 20260802043000_ipi903_materialize_persist_analysis_screen.sql

create or replace function public.materialize_onboarding_session(
  p_idempotency_key text,
  p_brand_name      text,
  p_brand_url       text
) returns jsonb
language plpgsql
security invoker
set search_path to 'public'
as $$
declare
  v_uid      uuid := (select auth.uid());
  v_session  public.onboarding_sessions%rowtype;
  v_org_id   uuid;
  v_brand_id uuid;
  v_slug     text;
begin
  if v_uid is null then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  -- Plain SELECT — SELECT RLS only — so materialized rows remain visible for replay.
  select * into v_session
    from public.onboarding_sessions
   where user_id = v_uid and idempotency_key = p_idempotency_key;

  if not found then
    raise exception 'session not found' using errcode = 'P0002';
  end if;

  if v_session.status = 'materialized' then
    -- Fail closed: org/brand columns are nullable; no CHECK ties them to status.
    if v_session.organization_id is null or v_session.brand_id is null then
      raise exception 'materialized session is incomplete' using errcode = 'P0002';
    end if;
    -- IPI-903: heal sessions stuck below analysis (screen 12).
    if v_session.current_screen < 12 then
      perform set_config('app.onboarding_materializing', 'on', true);
      update public.onboarding_sessions
         set current_screen = 12
       where id = v_session.id;
    end if;
    return jsonb_build_object(
      'organization_id', v_session.organization_id,
      'brand_id',        v_session.brand_id
    );
  end if;

  -- Lock the draft row. UPDATE RLS still applies here (status must be draft).
  select * into v_session
    from public.onboarding_sessions
   where id = v_session.id and status = 'draft'
   for update;

  if not found then
    -- Lost the race: peer committed materialize between our reads.
    select * into v_session
      from public.onboarding_sessions
     where user_id = v_uid and idempotency_key = p_idempotency_key;

    if found and v_session.status = 'materialized' then
      if v_session.organization_id is null or v_session.brand_id is null then
        raise exception 'materialized session is incomplete' using errcode = 'P0002';
      end if;
      if v_session.current_screen < 12 then
        perform set_config('app.onboarding_materializing', 'on', true);
        update public.onboarding_sessions
           set current_screen = 12
         where id = v_session.id;
      end if;
      return jsonb_build_object(
        'organization_id', v_session.organization_id,
        'brand_id',        v_session.brand_id
      );
    end if;

    raise exception 'session not found' using errcode = 'P0002';
  end if;

  -- Pre-generated, NOT from INSERT ... RETURNING (IPI-809 RETURNING/RLS trap).
  v_org_id   := gen_random_uuid();
  v_brand_id := gen_random_uuid();
  v_slug     := left(regexp_replace(lower(p_brand_name), '[^a-z0-9]+', '-', 'g'), 40)
                || '-' || left(v_org_id::text, 8);

  insert into public.organizations (id, name, slug, owner_id, type)
  values (v_org_id, p_brand_name, v_slug, v_uid, 'brand');

  insert into public.brands (id, name, org_id, user_id, brand_url)
  values (v_brand_id, p_brand_name, v_org_id, v_uid, p_brand_url);

  perform set_config('app.onboarding_materializing', 'on', true);

  update public.onboarding_sessions
     set status = 'materialized',
         organization_id = v_org_id,
         brand_id = v_brand_id,
         current_screen = 12
   where id = v_session.id;

  return jsonb_build_object('organization_id', v_org_id, 'brand_id', v_brand_id);
end $$;

revoke execute on function public.materialize_onboarding_session(text, text, text) from public, anon;
grant  execute on function public.materialize_onboarding_session(text, text, text) to authenticated;
