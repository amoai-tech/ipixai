-- ============================================================================
-- Migration: Create Cloudinary Assets Table
-- Purpose: Track Cloudinary-managed assets
-- Affected: public.cloudinary_assets table
-- Dependencies: public.assets
-- ============================================================================

-- Cloudinary assets: Cloudinary asset metadata linked to FashionOS assets
create table if not exists public.cloudinary_assets (
  id uuid default uuid_generate_v4() primary key,
  asset_id uuid references public.assets(id) on delete cascade not null,
  
  -- Cloudinary identifiers
  public_id text not null unique,
  secure_url text not null,
  resource_type text not null, -- 'image', 'video', 'raw'
  
  -- Dimensions
  width integer,
  height integer,
  
  -- Metadata
  folder text, -- Cloudinary folder path
  
  -- Timestamps
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  
  unique(asset_id)
);

comment on table public.cloudinary_assets is 'Cloudinary asset metadata linked to FashionOS assets';

-- Indexes for performance
create index if not exists idx_cloudinary_assets_asset on public.cloudinary_assets(asset_id);
create index if not exists idx_cloudinary_assets_public_id on public.cloudinary_assets(public_id);
create index if not exists idx_cloudinary_assets_folder on public.cloudinary_assets(folder) where folder is not null;

-- Enable RLS
alter table public.cloudinary_assets enable row level security;

-- Drop existing policies if they exist
drop policy if exists "anon_select_cloudinary_assets" on public.cloudinary_assets;
drop policy if exists "authenticated_select_cloudinary_assets" on public.cloudinary_assets;
drop policy if exists "authenticated_insert_cloudinary_assets" on public.cloudinary_assets;
drop policy if exists "authenticated_update_cloudinary_assets" on public.cloudinary_assets;
drop policy if exists "authenticated_delete_cloudinary_assets" on public.cloudinary_assets;

-- RLS Policies: Users can view Cloudinary assets for their own assets
-- Anonymous users: No access
create policy "anon_select_cloudinary_assets"
  on public.cloudinary_assets for select
  to anon
  using (false);

-- Authenticated users can view Cloudinary assets for their own assets
create policy "authenticated_select_cloudinary_assets"
  on public.cloudinary_assets for select
  to authenticated
  using (
    exists (
      select 1 from public.assets
      where assets.id = cloudinary_assets.asset_id
      and assets.shoot_id in (
        select id from public.shoots
        where designer_id = auth.uid()
      )
    )
  );

-- Authenticated users can create Cloudinary assets for their own assets
create policy "authenticated_insert_cloudinary_assets"
  on public.cloudinary_assets for insert
  to authenticated
  with check (
    exists (
      select 1 from public.assets
      where assets.id = cloudinary_assets.asset_id
      and assets.shoot_id in (
        select id from public.shoots
        where designer_id = auth.uid()
      )
    )
  );

-- Authenticated users can update Cloudinary assets for their own assets
create policy "authenticated_update_cloudinary_assets"
  on public.cloudinary_assets for update
  to authenticated
  using (
    exists (
      select 1 from public.assets
      where assets.id = cloudinary_assets.asset_id
      and assets.shoot_id in (
        select id from public.shoots
        where designer_id = auth.uid()
      )
    )
  )
  with check (
    exists (
      select 1 from public.assets
      where assets.id = cloudinary_assets.asset_id
      and assets.shoot_id in (
        select id from public.shoots
        where designer_id = auth.uid()
      )
    )
  );

-- Authenticated users can delete Cloudinary assets for their own assets
create policy "authenticated_delete_cloudinary_assets"
  on public.cloudinary_assets for delete
  to authenticated
  using (
    exists (
      select 1 from public.assets
      where assets.id = cloudinary_assets.asset_id
      and assets.shoot_id in (
        select id from public.shoots
        where designer_id = auth.uid()
      )
    )
  );
;
