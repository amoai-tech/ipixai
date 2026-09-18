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
-- non-loopback database host. Every actor signs in through the real /login UI
-- against real GoTrue, so RLS, the RPC privilege split and the authenticated
-- routes are exercised exactly as in production.
--
--   Org A  iPix 1084 Org A   editor-a (owner)  + viewer-a (viewer)  + Brand A
--   Org B  iPix 1084 Org B   orgb     (owner)                       + Brand B
--
-- The three auth users are NOT created here. They are created (or repaired)
-- through GoTrue's own admin API by scripts/run-approval-001-e2e.mjs, because a
-- hand-built auth.users/auth.identities row is GoTrue-version sensitive: it
-- verifies locally but fails in CI with
-- `500 {"code":"unexpected_failure","message":"Database error querying schema"}`.
-- The admin API is the canonical, version-stable way to mint a password user.
--
-- Local-only credential for these throwaway accounts (see the runner). It is
-- not a secret and never reaches a hosted environment.

begin;

-- ---------------------------------------------------------------------------
-- Organizations (the auto-add-owner trigger seeds the owner membership).
-- The owner_id foreign key also proves the runner's users exist.
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
