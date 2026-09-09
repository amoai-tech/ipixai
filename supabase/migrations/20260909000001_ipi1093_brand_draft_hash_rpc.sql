-- IPI-1093 · BRAND-INTEL-001 — get_brand_draft_hash read RPC
-- Server-computed sha256 of brands.ai_profile_draft::text, matching the
-- approve/reject RPCs' extensions.digest computation so the workflow and
-- operator UI can display the exact reviewed-artifact identity without
-- recomputing it client-side (JS JSON.stringify key order differs from
-- Postgres jsonb::text canonical serialization).
-- Rollback: drop function public.get_brand_draft_hash(uuid);

create or replace function public.get_brand_draft_hash(p_brand_id uuid)
returns text
language sql
stable
set search_path = ''
as $$
  select encode(extensions.digest(ai_profile_draft::text, 'sha256'), 'hex')
  from public.brands
  where id = p_brand_id
$$;

revoke all on function public.get_brand_draft_hash(uuid) from public, anon;
grant execute on function public.get_brand_draft_hash(uuid) to authenticated, service_role;