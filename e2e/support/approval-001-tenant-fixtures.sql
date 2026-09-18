-- IPI-1084 · APPROVAL-001 — PR 2b browser-proof tenant fixtures (LOCAL SUPABASE ONLY).
--
-- The hosted QA environment has exactly two isolated owners (iPix QA Org A / B)
-- with zero brands and no viewer membership, so it cannot express the required
-- "Org A editor allowed / Org A viewer denied / Org B denied" proof. Creating a
-- viewer account there would mean writing users into a hosted project, which
-- this task forbids.
--
-- These fixtures are therefore seeded only into the local `supabase start`
-- stack, where writes are sanctioned, and the seeding runner refuses any
-- non-loopback database host. Every actor below signs in through the real
-- /login UI against real GoTrue, so RLS, the RPC privilege split and the
-- authenticated routes are exercised exactly as in production.
--
-- Fixed UUIDs keep the proof deterministic; the spec references no row by
-- discovery, so a missing fixture fails loudly instead of silently passing.
--
--   Org A  iPix 1084 Org A   editor-a (owner)  + viewer-a (viewer)  + Brand A
--   Org B  iPix 1084 Org B   orgb     (owner)                       + Brand B
--
-- Local-only credential for these throwaway accounts. It is not a secret and
-- never reaches a hosted environment.

begin;

-- ---------------------------------------------------------------------------
-- Actors
--
-- `instance_id` must be the zero UUID: GoTrue's user lookup filters on it, so a
-- NULL instance_id makes every real password sign-in fail with the generic
-- "Invalid login credentials" even though the bcrypt hash verifies. The token
-- columns are left NULL (GoTrue's own default) for the same reason. bcrypt cost
-- 10 matches what GoTrue writes itself.
-- ---------------------------------------------------------------------------
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  (
    '10840000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'ipi1084-editor-a@ipix.test', extensions.crypt('ipi1084-local-e2e-password', extensions.gen_salt('bf', 10)), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"IPI-1084 Org A Editor"}'::jsonb,
    now(), now()
  ),
  (
    '10840000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'ipi1084-viewer-a@ipix.test', extensions.crypt('ipi1084-local-e2e-password', extensions.gen_salt('bf', 10)), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"IPI-1084 Org A Viewer"}'::jsonb,
    now(), now()
  ),
  (
    '10840000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'ipi1084-orgb@ipix.test', extensions.crypt('ipi1084-local-e2e-password', extensions.gen_salt('bf', 10)), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"IPI-1084 Org B Owner"}'::jsonb,
    now(), now()
  )
on conflict (id) do update
  set encrypted_password = excluded.encrypted_password,
      instance_id = excluded.instance_id,
      email_confirmed_at = excluded.email_confirmed_at,
      updated_at = now();

-- The email identity row GoTrue needs in order to complete a password grant.
insert into auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select u.id, u.id::text, u.id,
       jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true, 'phone_verified', false),
       'email', now(), now(), now()
from auth.users u
where u.id in (
  '10840000-0000-4000-8000-000000000001',
  '10840000-0000-4000-8000-000000000002',
  '10840000-0000-4000-8000-000000000003'
)
on conflict (provider_id, provider) do nothing;

-- ---------------------------------------------------------------------------
-- Organizations (the auto-add-owner trigger seeds the owner membership)
-- ---------------------------------------------------------------------------
insert into public.organizations (id, name, slug, type, owner_id)
values
  ('10840000-0000-4000-8000-00000000000a', 'iPix 1084 Org A', 'ipix-1084-org-a', 'brand', '10840000-0000-4000-8000-000000000001'),
  ('10840000-0000-4000-8000-00000000000b', 'iPix 1084 Org B', 'ipix-1084-org-b', 'brand', '10840000-0000-4000-8000-000000000003')
on conflict (id) do update
  set name = excluded.name, owner_id = excluded.owner_id, updated_at = now();

-- Membership is explicit and idempotent, including the viewer row the hosted
-- fixtures cannot provide.
insert into public.org_members (org_id, user_id, role)
values
  ('10840000-0000-4000-8000-00000000000a', '10840000-0000-4000-8000-000000000001', 'owner'),
  ('10840000-0000-4000-8000-00000000000a', '10840000-0000-4000-8000-000000000002', 'viewer'),
  ('10840000-0000-4000-8000-00000000000b', '10840000-0000-4000-8000-000000000003', 'owner')
on conflict (org_id, user_id) do update set role = excluded.role;

-- ---------------------------------------------------------------------------
-- One brand per org — the review is authorized against the brand's org.
-- ---------------------------------------------------------------------------
insert into public.brands (id, user_id, name, org_id)
values
  ('10840000-0000-4000-8000-0000000000aa', '10840000-0000-4000-8000-000000000001', 'IPI-1084 Brand A', '10840000-0000-4000-8000-00000000000a'),
  ('10840000-0000-4000-8000-0000000000bb', '10840000-0000-4000-8000-000000000003', 'IPI-1084 Brand B', '10840000-0000-4000-8000-00000000000b')
on conflict (id) do update
  set name = excluded.name, user_id = excluded.user_id, org_id = excluded.org_id, updated_at = now();

commit;
