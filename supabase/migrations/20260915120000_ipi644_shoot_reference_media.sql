-- IPI-644 · SHOOT-DATA-002C — Visual Shot-Type Reference Browser (data + security contract).
--
-- Ownership boundary (see issue IPI-644):
--   * Supabase/Postgres owns curated reference metadata, the stable logical key,
--     and one exact curator-approved Cloudinary identity/version mapping.
--   * Cloudinary owns the media binary and authenticated delivery only.
--   * Engineering defines the schema and the least-privilege read path. It does
--     NOT invent the approved visual set: a mapping row is only ever written
--     after a human/content owner approves the exact asset_id + version +
--     provenance/rights (see rights_status CHECK below).
--
-- This migration does three things and nothing else:
--   1. Adds a stored immutable `shoot.shot_type_references.reference_key`
--      (backfilled once from the collision-free category/subcategory/angle
--      tuple so identity survives later display-metadata edits).
--   2. Adds the one-to-one `shoot.shot_type_reference_media` mapping table that
--      records the exact approved Cloudinary asset_id + version + provenance.
--      It is server-only: RLS on, no policies, no client privileges, and the
--      provider-identity resolver is granted to `service_role` only so an
--      authenticated browser can never read `public_id`/`version` directly
--      through PostgREST.
--   3. Hardens the public reference read surface to least privilege:
--      anon loses all access, authenticated keeps SELECT only, and the exact
--      approved mapping is exposed to clients as a boolean `has_preview` plus a
--      server-signed preview URL — never as public_id/version/secret.

-- ---------------------------------------------------------------------------
-- 1. Stable logical key
-- ---------------------------------------------------------------------------

alter table shoot.shot_type_references
  add column if not exists reference_key text;

-- One-time backfill from the canonical taxonomy tuple. The live table has 49
-- rows with unique(category, subcategory, angle) = 49 and 0 collisions
-- (verified 2026-09-15), so this normalization is injective for the current
-- data. The guard block below fails the migration loudly if that is ever false
-- rather than silently shipping a lossy/duplicate identity.
update shoot.shot_type_references
set reference_key = lower(
  trim(
    both '_' from regexp_replace(
      coalesce(category, '') || ' ' || coalesce(subcategory, '') || ' ' || coalesce(angle, ''),
      '[^a-zA-Z0-9]+',
      '_',
      'g'
    )
  )
)
where reference_key is null;

do $$
declare
  duplicate_count int;
  blank_count int;
begin
  select count(*) into duplicate_count
  from (
    select reference_key
    from shoot.shot_type_references
    group by reference_key
    having count(*) > 1
  ) duplicates;
  if duplicate_count > 0 then
    raise exception 'IPI-644: reference_key backfill is not unique (% duplicated keys); STOP and re-derive identity instead of guessing', duplicate_count;
  end if;

  select count(*) into blank_count
  from shoot.shot_type_references
  where reference_key is null or length(btrim(reference_key)) = 0;
  if blank_count > 0 then
    raise exception 'IPI-644: reference_key backfill produced % blank key(s); refusing to ship a nullable logical identity', blank_count;
  end if;
end
$$;

alter table shoot.shot_type_references
  alter column reference_key set not null;

alter table shoot.shot_type_references
  add constraint shot_type_references_reference_key_key unique (reference_key);

-- reference_key must be immutable: it is the stable logical identity that
-- persists across environments, and downstream consumers may persist it. A
-- privileged UPDATE must not silently re-key an existing catalog row (that
-- would stop the same row from identifying the same reference). Display
-- metadata (description/angle/tags/...) stays editable; only the key is frozen.
create or replace function shoot.shot_type_references_lock_reference_key()
returns trigger
language plpgsql
as $$
begin
  if new.reference_key is distinct from old.reference_key then
    raise exception 'IPI-644: reference_key is immutable (attempted % -> %); add a new catalog row instead of re-keying', old.reference_key, new.reference_key;
  end if;
  return new;
end;
$$;

drop trigger if exists shot_type_references_lock_reference_key on shoot.shot_type_references;
create trigger shot_type_references_lock_reference_key
before update on shoot.shot_type_references
for each row execute function shoot.shot_type_references_lock_reference_key();

-- ---------------------------------------------------------------------------
-- 2. Exact approved Cloudinary mapping (server-only)
-- ---------------------------------------------------------------------------

create table if not exists shoot.shot_type_reference_media (
  reference_id uuid primary key
    references shoot.shot_type_references (id) on delete cascade,
  -- Immutable provider identity. `public_id` is address metadata, not identity.
  cloudinary_asset_id text not null,
  public_id text not null,
  version bigint not null,
  format text not null,
  resource_type text not null,
  delivery_type text not null,
  -- Human/content owner recorded for the approved exact version.
  provenance_source text not null,
  rights_status text not null,
  approved_at timestamptz not null default now(),
  approved_by uuid,
  constraint shot_type_reference_media_asset_id_not_blank
    check (length(btrim(cloudinary_asset_id)) > 0),
  constraint shot_type_reference_media_public_id_not_blank
    check (length(btrim(public_id)) > 0),
  constraint shot_type_reference_media_provenance_not_blank
    check (length(btrim(provenance_source)) > 0),
  -- Invariants from the IPI-644 data contract: the media must be an exact,
  -- authenticated, image version whose rights are explicitly approved.
  constraint shot_type_reference_media_version_positive check (version > 0),
  constraint shot_type_reference_media_resource_type_image check (resource_type = 'image'),
  constraint shot_type_reference_media_delivery_type_authenticated check (delivery_type = 'authenticated'),
  constraint shot_type_reference_media_rights_approved check (rights_status = 'approved_for_reference')
);

alter table shoot.shot_type_reference_media enable row level security;

-- No policies on purpose: this is a deny-all server-only table. Client roles
-- must never read provider identity/version directly; the approved mapping is
-- resolved through the SECURITY DEFINER functions below. Revoking here (rather
-- than only relying on RLS) keeps `catalog-security-regression.sql`'s
-- "RLS deny-all table still client-privileged" invariant satisfied.
revoke all on table shoot.shot_type_reference_media from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Least-privilege read path
-- ---------------------------------------------------------------------------

-- Boolean-only availability for the catalog view. Reveals existence, never the
-- provider identity/version. Pinned search_path per the SB-SEC catalog rule.
create or replace function public.shot_type_reference_has_preview(p_reference_id uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
    from shoot.shot_type_reference_media m
    where m.reference_id = p_reference_id
  );
$$;

revoke all on function public.shot_type_reference_has_preview(uuid) from public, anon;
grant execute on function public.shot_type_reference_has_preview(uuid) to authenticated;

-- Server-side resolution of the exact approved mapping. Returns the reference
-- existence flag separately from "has an approved mapping" so the caller can
-- distinguish not-found from no-media and fail closed with the right reason.
--
-- service_role only: this returns raw provider identity (public_id/version), so
-- it must never be reachable by an authenticated browser through PostgREST. The
-- preview route is a verified server path that uses the service-role client.
create or replace function public.get_shot_reference_media(p_reference_id uuid)
returns table (
  reference_exists boolean,
  has_approved_media boolean,
  cloudinary_asset_id text,
  public_id text,
  version bigint,
  format text,
  resource_type text,
  delivery_type text,
  rights_status text
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
    m.delivery_type,
    m.rights_status
  from shoot.shot_type_references r
  left join shoot.shot_type_reference_media m on m.reference_id = r.id
  where r.id = p_reference_id;
$$;

revoke all on function public.get_shot_reference_media(uuid) from public, anon, authenticated;
grant execute on function public.get_shot_reference_media(uuid) to service_role;

-- Re-expose the canonical catalog with the stable key + availability. Columns
-- are appended so `create or replace view` is valid (existing column
-- names/order/types must match). security_invoker stays true: the view runs as
-- the caller, and the caller is checked by the underlying table RLS/policy.
create or replace view public.shot_type_references_view as
select
  r.id,
  r.category,
  r.subcategory,
  r.angle,
  r.description,
  r.channel_fit,
  r.model_type,
  r.background,
  r.tags,
  r.reference_key,
  public.shot_type_reference_has_preview(r.id) as has_preview
from shoot.shot_type_references r;

alter view public.shot_type_references_view set (security_invoker = true);

-- Least privilege: anon must not read or write the reference view;
-- authenticated may only SELECT it. Revoke everything first so a future
-- default-privilege change cannot silently re-grant DML through this view.
revoke all on table public.shot_type_references_view from public, anon, authenticated;
grant select on table public.shot_type_references_view to authenticated;

-- The underlying canonical table keeps its existing authenticated SELECT policy
-- and read-only shape. Do NOT broaden it.
