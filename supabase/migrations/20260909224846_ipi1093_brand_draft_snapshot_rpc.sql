-- IPI-1093 · BRAND-INTEL-001 — get_brand_draft_snapshot read RPC
--
-- get_brand_draft_hash (20260909000001) hashes ai_profile_draft in one
-- statement, but a caller needing BOTH the draft content and its hash --
-- the Brand Detail review page -- had to issue two separate reads: one
-- plain SELECT for the draft, one RPC call for the hash. Those are two
-- independent reads of the same mutable column, not a snapshot: if the
-- draft is regenerated/mutated between them, the page renders the OLD
-- draft content bound to the NEW draft's hash. The operator reviews
-- content A on screen but their Approve click carries hash(B); the
-- approval RPC re-verifies hash(B) against the (now-current) stored
-- draft B, which matches, and silently promotes B -- content the
-- operator never actually looked at. This closes that race by returning
-- both values from the same single-statement read.
--
-- Rollback: drop function public.get_brand_draft_snapshot(uuid);

create or replace function public.get_brand_draft_snapshot(p_brand_id uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'draft', ai_profile_draft,
    'hash', encode(extensions.digest(ai_profile_draft::text, 'sha256'), 'hex')
  )
  from public.brands
  where id = p_brand_id
$$;

revoke all on function public.get_brand_draft_snapshot(uuid) from public, anon;
grant execute on function public.get_brand_draft_snapshot(uuid) to authenticated, service_role;
