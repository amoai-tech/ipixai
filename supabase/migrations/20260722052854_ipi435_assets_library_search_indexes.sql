-- IPI-435 · CLD-102 — Indexes for Supabase-first assets library search + cursor pages.
-- pg_trgm already enabled in 20251129061515_extensions_enums_20250127.sql.
-- tags GIN (idx_assets_tags), brand_id, status, cloudinary_public_id btree already exist.

create index if not exists assets_created_at_id_idx
  on public.assets (created_at desc, id desc);

create index if not exists assets_cloudinary_public_id_trgm_idx
  on public.assets
  using gin (cloudinary_public_id gin_trgm_ops)
  where cloudinary_public_id is not null;

-- Filename / title / alt live in metadata JSON today (no dedicated columns yet).
create index if not exists assets_metadata_original_filename_trgm_idx
  on public.assets
  using gin ((metadata ->> 'original_filename') gin_trgm_ops)
  where (metadata ? 'original_filename');

create index if not exists assets_metadata_title_trgm_idx
  on public.assets
  using gin ((metadata ->> 'title') gin_trgm_ops)
  where (metadata ? 'title');

create index if not exists assets_metadata_alt_text_trgm_idx
  on public.assets
  using gin ((metadata ->> 'alt_text') gin_trgm_ops)
  where (metadata ? 'alt_text');

comment on index public.assets_created_at_id_idx is
  'IPI-435 stable cursor pagination (created_at, id)';
comment on index public.assets_cloudinary_public_id_trgm_idx is
  'IPI-435 partial public_id / filename-path search via pg_trgm';
