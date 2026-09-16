-- IPI-644 · SHOOT-DATA-002C — drop the rights-evidence requirement.
--
-- Product decision: this reference library is an internal, operator-curated set
-- and does not require a licensing/rights-evidence workflow. `rights_evidence`
-- was introduced by 20260915120000 and enforced by 20260915130000; both are
-- already deployed, so this is a forward-only migration that removes it.
--
-- What is deliberately kept:
--   * `approved_by` + its `auth.users` FK and validation — an approval must
--     still be attributable to a real human identity;
--   * `provenance_source` — a lightweight origin note, not a licensing claim;
--   * `rights_status` — a hardcoded exact-mapping marker
--     (`approved_for_reference`) that the preview read path still checks.
--
-- `record_shot_reference_media` is recreated with a 7-argument contract under
-- the same least-privilege boundary (SECURITY DEFINER, pinned empty
-- search_path, service_role-only EXECUTE, schema-qualified relations).

-- ---------------------------------------------------------------------------
-- 1. Drop the 8-argument recorder before changing the table it targets.
-- ---------------------------------------------------------------------------

drop function if exists public.record_shot_reference_media(uuid, text, text, bigint, text, text, text, uuid);

-- ---------------------------------------------------------------------------
-- 2. Remove the column and its not-blank CHECK.
-- ---------------------------------------------------------------------------

alter table shoot.shot_type_reference_media
  drop constraint if exists shot_type_reference_media_rights_evidence_not_blank;

alter table shoot.shot_type_reference_media
  drop column if exists rights_evidence;

-- ---------------------------------------------------------------------------
-- 3. Human-approved mapping recording (service_role only), without rights
--    evidence.
-- ---------------------------------------------------------------------------

create function public.record_shot_reference_media(
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

  -- The approver must be a real, canonical identity — a random or stale UUID is
  -- not an auditable approval. The FK on the table is the durable backstop; this
  -- check fails closed with a clear reason first.
  if not exists (select 1 from auth.users u where u.id = p_approved_by) then
    raise exception 'IPI-644: approved_by % does not resolve to a known user', p_approved_by
      using errcode = 'foreign_key_violation';
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
