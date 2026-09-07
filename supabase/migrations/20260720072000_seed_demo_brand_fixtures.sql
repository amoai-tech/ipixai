-- IPI-1162 · SB-MIG-003 — seed the two demo brand fixtures (Nike/Adidas) that
-- 20260720072001_ipi737_brand_url_backfill.sql assumes already exist.
--
-- These rows were only ever created directly in production (dashboard/manual
-- seed), never by a migration — confirmed by grepping the full recovered
-- 318-file chain for their fixed UUIDs. Without this file, a fresh replay
-- (local db reset, CI, a new clone) cannot pass ipi737's guard clause and the
-- whole migration chain aborts.
--
-- Not a rewrite of applied history: ipi737's own file is untouched. This is
-- new, additive fixture data, idempotent via ON CONFLICT DO NOTHING, so it is
-- also a safe no-op if ever replayed against a database that already has
-- these rows (e.g. production, where they already exist under this timestamp
-- gap and this migration is not intended to ever be pushed there).
--
-- org 00000000-0000-0000-0000-000000000001 ("Acme Corp") and its owning user
-- are the same class of gap: real in production, never created by any
-- migration (the org rows from 20251129062153/20251129174117 are unrelated
-- legacy FashionOS demo orgs, not this one). user_id is a synthetic fixture
-- owner that predates any real signup for these rows.

insert into auth.users (id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values (
  'fde772a8-80d5-4965-bc7f-da3c24ef37f2',
  'authenticated',
  'authenticated',
  'demo-seed-owner@ipix.invalid',
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb,
  now(),
  now()
)
on conflict (id) do nothing;

insert into public.organizations (id, name, slug, type, owner_id, plan)
values (
  '00000000-0000-0000-0000-000000000001',
  'Acme Corp',
  'acme',
  'agency',
  'fde772a8-80d5-4965-bc7f-da3c24ef37f2',
  'free'
)
on conflict (id) do nothing;

insert into public.org_members (org_id, user_id, role)
values (
  '00000000-0000-0000-0000-000000000001',
  'fde772a8-80d5-4965-bc7f-da3c24ef37f2',
  'editor'
)
on conflict (org_id, user_id) do nothing;

insert into public.brands (id, user_id, org_id, name, brand_url, creative_temperature_default)
values
  ('00000000-0000-0000-0000-000000000201', 'fde772a8-80d5-4965-bc7f-da3c24ef37f2', '00000000-0000-0000-0000-000000000001', 'Nike', null, 0.50),
  ('00000000-0000-0000-0000-000000000202', 'fde772a8-80d5-4965-bc7f-da3c24ef37f2', '00000000-0000-0000-0000-000000000001', 'Adidas', null, 0.50)
on conflict (id) do nothing;
