-- IPI-644 · SHOOT-DATA-002C — Visual Shot-Type Reference Browser (candidate approval boundary).
--
-- This migration closes the human-in-the-loop loop opened by IPI-644 Step 2. The
-- candidate pipeline (scripts/reference-library/candidates.ts) may create,
-- upload, tag, and validate Cloudinary candidates, but it must never silently
-- promote one to the official reference. Promotion is an explicit, recorded,
-- human-approved action: the CLI calls `public.record_shot_reference_media`
-- with the exact provider identity + version and the approving operator id, and
-- this function is the ONLY write path into `shoot.shot_type_reference_media`.
--
-- Least privilege:
--   * the function is SECURITY DEFINER with a pinned empty search_path, so it
--     runs as its owner regardless of the caller;
--   * EXECUTE is granted to `service_role` ONLY — an authenticated browser (or
--     anon) can never write or read provider identity through PostgREST;
--   * the values the function writes (`image`, `authenticated`,
--     `approved_for_reference`) are hardcoded, so a caller cannot record a
--     mapping that violates the table's exact-mapping invariants;
--   * `approved_by` is required, so no mapping can exist without a recorded
--     human approver.

-- ---------------------------------------------------------------------------
-- Human-approved mapping recording (service_role only)
-- ---------------------------------------------------------------------------

create or replace function public.record_shot_reference_media(
  p_reference_id uuid,
  p_cloudinary_asset_id text,
  p_public_id text,
  p_version bigint,
  p_format text,
  p_provenance_source text,
  p_approved_by uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_reference_id is null then
    raise exception 'IPI-644: reference id is required to record an approved reference mapping'
      using errcode = 'not_null_violation';
  end if;

  -- The locator must resolve to a canonical catalog row. A mapping for an
  -- unknown reference is a programming/race error and must not be recorded.
  if not exists (
    select 1 from shoot.shot_type_references r where r.id = p_reference_id
  ) then
    raise exception 'IPI-644: reference id % is not a canonical shot reference', p_reference_id
      using errcode = 'foreign_key_violation';
  end if;

  -- Approval is a human decision. Without an approver this is not an approved
  -- mapping, so refuse rather than record an unattributed authority.
  if p_approved_by is null then
    raise exception 'IPI-644: an explicit human approver is required to record an approved reference mapping'
      using errcode = 'not_null_violation';
  end if;

  -- Only ever write the exact-mapping invariants. Blank/version/resource/rights
  -- violations still fail the table CHECK constraints below.
  insert into shoot.shot_type_reference_media (
    reference_id,
    cloudinary_asset_id,
    public_id,
    version,
    format,
    resource_type,
    delivery_type,
    provenance_source,
    rights_status,
    approved_at,
    approved_by
  )
  values (
    p_reference_id,
    p_cloudinary_asset_id,
    p_public_id,
    p_version,
    p_format,
    'image',
    'authenticated',
    p_provenance_source,
    'approved_for_reference',
    now(),
    p_approved_by
  )
  on conflict (reference_id) do update set
    cloudinary_asset_id = excluded.cloudinary_asset_id,
    public_id = excluded.public_id,
    version = excluded.version,
    format = excluded.format,
    resource_type = excluded.resource_type,
    delivery_type = excluded.delivery_type,
    provenance_source = excluded.provenance_source,
    rights_status = excluded.rights_status,
    approved_at = excluded.approved_at,
    approved_by = excluded.approved_by;
end;
$$;

-- service_role only: the CLI is the sole writer, and this function carries raw
-- provider identity. Nothing else may EXECUTE it.
revoke all on function public.record_shot_reference_media(uuid, text, text, bigint, text, text, uuid)
  from public, anon, authenticated;
grant execute on function public.record_shot_reference_media(uuid, text, text, bigint, text, text, uuid)
  to service_role;

-- The CLI reads the bounded catalog as service_role, so it must be able to read
-- the public reference view. Grant it explicitly instead of relying on a
-- Supabase default-privilege assumption that a future migration could change.
grant select on table public.shot_type_references_view to service_role;
