-- ============================================================================
-- Migration: CLD-SPEC-001 / IPI-963 — Retire media_size_specs → image_specs
-- ----------------------------------------------------------------------------
-- Purpose:   `media_size_specs` (Nov 2025, 14 rows) has case-convention
--            duplicates with conflicting dims; `image_specs` (Jun 2026, 9 rows,
--            with platforms + image_type_defs) is the canonical model.
--            Live state (verified 2026-08-09, remote nvdlhrodvevgwdsneplk):
--              assets.media_size_spec_id         → 4 refs (all Shopify /
--                                                 Product Image / 2048x2048)
--              asset_variants.media_size_spec_id → 0 refs
--            No app code reads the column (only test fixtures + generated
--            types; fixtures updated in this PR).
-- Plan:      add image_spec_id → backfill via deterministic mapping → drop
--            old FK columns → FREEZE media_size_specs (one sprint; follow-up
--            drop after zero-reference proof window).
-- Rollback:  see bottom comment block.
-- ============================================================================

begin;

-- ---------- 1. New canonical reference column on assets --------------------
alter table public.assets
  add column if not exists image_spec_id uuid
  references public.image_specs(id) on delete set null;

comment on column public.assets.image_spec_id is
  'Canonical spec target → image_specs (CLD-SPEC-001). Replaces media_size_spec_id.';

create index if not exists idx_assets_image_spec
  on public.assets(image_spec_id) where image_spec_id is not null;

-- ---------- 2. Backfill the 4 live references ------------------------------
-- Deterministic mapping: platform slug + use_case → image_type slug + dims.
-- Live data: all 4 rows are Shopify / Product Image / 2048x2048 →
-- image_specs(shopify, product_image, 2048x2048). Join-based (not hardcoded
-- uuid) so it stays correct if rows change before merge.
-- NOTE: the update target (a) cannot be joined inside FROM — match via WHERE.
update public.assets a
set image_spec_id = s.id
from public.image_specs s
join public.platforms p on p.id = s.platform_id
join public.image_type_defs t on t.id = s.image_type_id
join public.media_size_specs m
  on lower(p.slug) = lower(m.platform)
  and t.slug = lower(replace(m.use_case, ' ', '_'))
  and s.width_px = m.recommended_width
  and s.height_px = m.recommended_height
where a.media_size_spec_id is not null
  and m.id = a.media_size_spec_id;

-- ---------- 2b. Safety net: fail loudly instead of silently losing refs -----
-- The slug mapping is not 1:1 for every use_case (e.g. product_main vs
-- product_image); if any asset failed to map, abort before the column drop.
do $$
begin
  if exists (
    select 1 from public.assets
    where media_size_spec_id is not null and image_spec_id is null
  ) then
    raise exception 'CLD-SPEC-001 backfill incomplete: % asset(s) still reference media_size_specs without an image_specs match', (
      select count(*) from public.assets
      where media_size_spec_id is not null and image_spec_id is null
    );
  end if;
end $$;

-- ---------- 3. Drop old FK columns (indexes drop with them) ----------------
-- Zero-reference check on asset_variants before the drop (defensive; live
-- state verified 0 refs, this guards fresh replays).
do $$
begin
  if exists (
    select 1 from public.asset_variants
    where media_size_spec_id is not null
  ) then
    raise exception 'CLD-SPEC-001: asset_variants still reference media_size_specs';
  end if;
end $$;

alter table public.assets
  drop column if exists media_size_spec_id;
alter table public.asset_variants
  drop column if exists media_size_spec_id;

-- ---------- 4. Freeze media_size_specs for one sprint ----------------------
-- No app writes exist (grants: postgres only for DML), so freeze = deprecation
-- marker + belt-and-braces revoke. Follow-up ticket drops the table after a
-- one-sprint zero-reference window.
comment on table public.media_size_specs is
  'DEPRECATED 2026-08-10 (CLD-SPEC-001 / IPI-963): conflicting duplicates; canonical model is image_specs (+ platforms, image_type_defs). Frozen — no new reads/writes. Drop scheduled after one-sprint zero-reference window.';

revoke insert, update, delete on public.media_size_specs from authenticated;
revoke insert, update, delete on public.media_size_specs from anon;
-- Freeze must block reads too: drop the legacy SELECT policies and revoke
-- SELECT so PostgREST clients cannot keep reading conflicting dims.
drop policy if exists anon_select_active_media_size_specs on public.media_size_specs;
drop policy if exists authenticated_select_active_media_size_specs on public.media_size_specs;
revoke select on public.media_size_specs from authenticated;
revoke select on public.media_size_specs from anon;

commit;

-- ============================================================================
-- ROLLBACK (manual — run as a separate down migration if needed)
-- ----------------------------------------------------------------------------
-- alter table public.assets add column media_size_spec_id uuid
--   references public.media_size_specs(id) on delete set null;
-- create index idx_assets_size_spec on public.assets(media_size_spec_id)
--   where media_size_spec_id is not null;
-- alter table public.asset_variants add column media_size_spec_id uuid
--   references public.media_size_specs(id) on delete set null;
-- create index idx_asset_variants_spec on public.asset_variants(media_size_spec_id)
--   where media_size_spec_id is not null;
-- -- backfill reverse mapping from image_spec_id if needed;
-- -- to restore pre-migration values exactly, restore from backup
-- -- (forward values were: 4 assets → Shopify/Product Image/2048x2048 row).
-- alter table public.assets drop column if exists image_spec_id;
-- ============================================================================
