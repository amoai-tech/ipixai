-- IPI-644 · SHOOT-DATA-002C — drop the licensing/rights fields from the
-- approved reference mapping.
--
-- Product decision: this reference library is an internal, operator-curated set
-- and does not run a licensing/rights-evidence workflow. `rights_evidence`
-- (introduced by 20260915120000, enforced by 20260915130000) and the
-- `rights_status` marker (`approved_for_reference`) exist only to carry that
-- removed workflow, so both are dropped here.
--
-- Both predecessor migrations are already deployed, so this is a forward-only
-- migration. The drops below are intentionally exact (no `if exists`): PR #188
-- guarantees those objects exist, so unexpected schema drift should fail loudly
-- rather than silently continue.
--
-- What is deliberately kept:
--   * `approved_by` + its `auth.users` FK and validation — an approval must
--     still be attributable to a real human identity;
--   * `provenance_source` — a lightweight origin note, not a licensing claim;
--   * `approved_at` — when the current mapping was approved.
--
-- Approval truth is now the existence of the approved mapping row itself: one
-- exact Cloudinary asset_id + version per reference. `record_shot_reference_media`
-- is recreated with a 7-argument contract under the same least-privilege
-- boundary (SECURITY DEFINER, pinned empty search_path, service_role-only
-- EXECUTE, schema-qualified relations).
--
-- The server-only reader `get_shot_reference_media` returns `rights_status` in
-- its OUT table, so it is dropped and recreated without that column as well. It
-- keeps the same boundary.

-- ---------------------------------------------------------------------------
-- 1. Drop the functions that depend on the columns being removed, before
--    changing the table they target.
--
--    `get_shot_reference_media` returns `m.rights_status` in its OUT table, so
--    Postgres would refuse to drop that column while it exists. Both functions
--    are recreated below.
-- ---------------------------------------------------------------------------

drop function public.record_shot_reference_media(uuid, text, text, bigint, text, text, text, uuid);
drop function public.get_shot_reference_media(uuid);

-- ---------------------------------------------------------------------------
-- 2. Remove the licensing/rights columns and their CHECK constraints.
-- ---------------------------------------------------------------------------

alter table shoot.shot_type_reference_media
  drop constraint shot_type_reference_media_rights_evidence_not_blank,
  drop constraint shot_type_reference_media_rights_approved;

alter table shoot.shot_type_reference_media
  drop column rights_evidence,
  drop column rights_status;

-- ---------------------------------------------------------------------------
-- 3. Human-approved mapping recording (service_role only), without rights
--    fields.
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

  -- Only ever write the exact-mapping invariants. Blank/version/resource
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
    now(),
    p_approved_by
  )
  -- This row represents the CURRENT approved mapping, not approval history.
  -- Re-approving a replacement asset/version intentionally updates approved_by
  -- and approved_at so they identify the human decision behind the current row.
  on conflict (reference_id) do update set
    cloudinary_asset_id = excluded.cloudinary_asset_id,
    public_id = excluded.public_id,
    version = excluded.version,
    format = excluded.format,
    resource_type = excluded.resource_type,
    delivery_type = excluded.delivery_type,
    provenance_source = excluded.provenance_source,
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

-- ---------------------------------------------------------------------------
-- 4. Recreate the server-side reader without the removed rights column.
--    Identical shape minus `rights_status`; raw provider identity stays
--    service_role-only.
-- ---------------------------------------------------------------------------

create function public.get_shot_reference_media(p_reference_id uuid)
returns table (
  reference_exists boolean,
  has_approved_media boolean,
  cloudinary_asset_id text,
  public_id text,
  version bigint,
  format text,
  resource_type text,
  delivery_type text
)
language sql
security definer
set search_path = ''
stable
as $$
  select
    true,
    (m.reference_id is not null),
    m.cloudinary_asset_id,
    m.public_id,
    m.version,
    m.format,
    m.resource_type,
    m.delivery_type
  from shoot.shot_type_references r
  left join shoot.shot_type_reference_media m on m.reference_id = r.id
  where r.id = p_reference_id;
$$;

revoke all on function public.get_shot_reference_media(uuid) from public, anon, authenticated;
grant execute on function public.get_shot_reference_media(uuid) to service_role;

-- The CLI reads the bounded catalog as service_role, so it must be able to read
-- the public reference view. Grant it explicitly instead of relying on a
-- Supabase default-privilege assumption that a future migration could change.
grant select on table public.shot_type_references_view to service_role;
