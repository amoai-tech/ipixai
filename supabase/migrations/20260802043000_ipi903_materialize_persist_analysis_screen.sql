-- IPI-903 · ONB2-INT-001b1 — persist analysis screen with materialize
--
-- After materialize, draft RLS blocks client updates to current_screen, so a
-- successful RPC that left the row at screen 11 forced resume back to the
-- pre-analysis marketing step. Set current_screen = 12 (analysis) in the same
-- authorized UPDATE that flips status/IDs. Replay bumps stuck rows still at < 12.
--
-- Rollback: recreate materialize_onboarding_session from
-- 20260801051934_onboarding_sessions_and_materialize_rpc.sql (omit current_screen).

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

  select * into v_session
    from public.onboarding_sessions
   where user_id = v_uid and idempotency_key = p_idempotency_key
   for update;

  if not found then
    raise exception 'session not found' using errcode = 'P0002';
  end if;

  -- Replay path: second concurrent caller after the first commits.
  if v_session.status = 'materialized' then
    -- Heal sessions materialized before this migration (stuck at screen 11).
    if v_session.current_screen < 12 then
      perform set_config('app.onboarding_materializing', 'on', true);
      update public.onboarding_sessions
         set current_screen = 12
       where id = v_session.id;
    end if;
    return jsonb_build_object('organization_id', v_session.organization_id,
                              'brand_id',        v_session.brand_id);
  end if;

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
