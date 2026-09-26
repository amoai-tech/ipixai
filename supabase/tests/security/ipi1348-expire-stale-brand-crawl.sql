-- IPI-1348 · BRAND-INTEL-PROD-002 — stale crawl recovery proof.
--
-- Proves 20260926100000_ipi1348_expire_stale_brand_crawl.sql: a
-- crawl_running brand older than 60 minutes becomes 'failed' (Retry comes
-- back), a fresh crawl and a crawl_complete brand are left alone, and the
-- existing analysis_running rules still hold. Runs in supabase-fresh-replay.
--
-- Rollback: none — proof only, wrapped in begin/rollback.

begin;

do $$
declare
  owner_id       uuid := gen_random_uuid();
  org_id         uuid := gen_random_uuid();
  stale_crawl    uuid := gen_random_uuid();
  fresh_crawl    uuid := gen_random_uuid();
  stale_complete uuid := gen_random_uuid();
  stale_analysis uuid := gen_random_uuid();
  fresh_analysis uuid := gen_random_uuid();
  expired_count  int;
  s              text;
begin
  insert into auth.users (id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values (owner_id, 'authenticated', 'authenticated', 'ipi1348-stale@ipix.test', now(), '{"provider":"email"}'::jsonb, '{}'::jsonb, now(), now());

  insert into public.organizations (id, name, slug, type, owner_id, plan)
  values (org_id, 'IPI1348 Stale Org', 'ipi1348-stale-org', 'agency', owner_id, 'free');

  -- brands_set_updated_at fires on UPDATE only, so these INSERTs keep the
  -- backdated updated_at values.
  insert into public.brands (id, name, org_id, user_id, intake_status, updated_at) values
    (stale_crawl,    'IPI1348 stale crawl',    org_id, owner_id, 'crawl_running',    now() - interval '2 hours'),
    (fresh_crawl,    'IPI1348 fresh crawl',    org_id, owner_id, 'crawl_running',    now() - interval '20 minutes'),
    (stale_complete, 'IPI1348 stale complete', org_id, owner_id, 'crawl_complete',   now() - interval '2 hours'),
    (stale_analysis, 'IPI1348 stale analysis', org_id, owner_id, 'analysis_running', now() - interval '30 minutes'),
    (fresh_analysis, 'IPI1348 fresh analysis', org_id, owner_id, 'analysis_running', now() - interval '2 minutes');

  expired_count := public.expire_stale_brand_analysis();
  if expired_count <> 2 then
    raise exception 'expected 2 expired brands (stale crawl + stale analysis), got %', expired_count;
  end if;

  select intake_status into s from public.brands where id = stale_crawl;
  if s <> 'failed' then raise exception 'stale crawl_running must become failed, got %', s; end if;

  select intake_status into s from public.brands where id = fresh_crawl;
  if s <> 'crawl_running' then raise exception 'fresh crawl_running must be left alone, got %', s; end if;

  select intake_status into s from public.brands where id = stale_complete;
  if s <> 'crawl_complete' then raise exception 'crawl_complete must be left alone, got %', s; end if;

  select intake_status into s from public.brands where id = stale_analysis;
  if s <> 'failed' then raise exception 'stale analysis_running must become failed, got %', s; end if;

  select intake_status into s from public.brands where id = fresh_analysis;
  if s <> 'analysis_running' then raise exception 'fresh analysis_running must be left alone, got %', s; end if;

  raise notice 'IPI-1348 stale crawl recovery: PASS';
end
$$;

rollback;
