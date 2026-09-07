-- ============================================================================
-- Migration: Create Amazon Media Links Table
-- Purpose: Map FashionOS assets to Amazon listings
-- Affected: public.amazon_media_links table
-- Dependencies: public.assets, public.amazon_products
-- ============================================================================

-- Amazon media links: Maps FashionOS assets to Amazon product images
create table if not exists public.amazon_media_links (
  id uuid default uuid_generate_v4() primary key,
  asset_id uuid references public.assets(id) on delete cascade not null,
  amazon_product_id uuid references public.amazon_products(id) on delete cascade not null,
  
  -- Amazon media info
  amazon_image_url text, -- URL after upload to Amazon
  
  -- Export metadata
  exported_at timestamptz default now() not null,
  
  -- Timestamps
  created_at timestamptz default now() not null,
  
  unique(asset_id, amazon_product_id)
);

comment on table public.amazon_media_links is 'Maps FashionOS assets to Amazon product images';

-- Indexes for performance
create index if not exists idx_amazon_media_links_asset on public.amazon_media_links(asset_id);
create index if not exists idx_amazon_media_links_product on public.amazon_media_links(amazon_product_id);

-- Enable RLS
alter table public.amazon_media_links enable row level security;

-- Drop existing policies if they exist
drop policy if exists "anon_select_amazon_media_links" on public.amazon_media_links;
drop policy if exists "authenticated_select_amazon_media_links" on public.amazon_media_links;
drop policy if exists "authenticated_insert_amazon_media_links" on public.amazon_media_links;
drop policy if exists "authenticated_update_amazon_media_links" on public.amazon_media_links;
drop policy if exists "authenticated_delete_amazon_media_links" on public.amazon_media_links;

-- RLS Policies: Users can view links for their own assets and products
-- Anonymous users: No access
create policy "anon_select_amazon_media_links"
  on public.amazon_media_links for select
  to anon
  using (false);

-- Authenticated users can view links for their own assets and products
create policy "authenticated_select_amazon_media_links"
  on public.amazon_media_links for select
  to authenticated
  using (
    exists (
      select 1 from public.assets
      join public.shoots on shoots.id = assets.shoot_id
      join public.amazon_products on amazon_products.id = amazon_media_links.amazon_product_id
      join public.amazon_connections on amazon_connections.seller_id = amazon_products.seller_id
      where assets.id = amazon_media_links.asset_id
      and (shoots.designer_id = auth.uid() or amazon_connections.user_id = auth.uid())
    )
  );

-- Authenticated users can create links for their own assets and products
create policy "authenticated_insert_amazon_media_links"
  on public.amazon_media_links for insert
  to authenticated
  with check (
    exists (
      select 1 from public.assets
      join public.shoots on shoots.id = assets.shoot_id
      join public.amazon_products on amazon_products.id = amazon_media_links.amazon_product_id
      join public.amazon_connections on amazon_connections.seller_id = amazon_products.seller_id
      where assets.id = amazon_media_links.asset_id
      and (shoots.designer_id = auth.uid() or amazon_connections.user_id = auth.uid())
    )
  );

-- Authenticated users can update links for their own assets and products
create policy "authenticated_update_amazon_media_links"
  on public.amazon_media_links for update
  to authenticated
  using (
    exists (
      select 1 from public.assets
      join public.shoots on shoots.id = assets.shoot_id
      join public.amazon_products on amazon_products.id = amazon_media_links.amazon_product_id
      join public.amazon_connections on amazon_connections.seller_id = amazon_products.seller_id
      where assets.id = amazon_media_links.asset_id
      and (shoots.designer_id = auth.uid() or amazon_connections.user_id = auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.assets
      join public.shoots on shoots.id = assets.shoot_id
      join public.amazon_products on amazon_products.id = amazon_media_links.amazon_product_id
      join public.amazon_connections on amazon_connections.seller_id = amazon_products.seller_id
      where assets.id = amazon_media_links.asset_id
      and (shoots.designer_id = auth.uid() or amazon_connections.user_id = auth.uid())
    )
  );

-- Authenticated users can delete links for their own assets and products
create policy "authenticated_delete_amazon_media_links"
  on public.amazon_media_links for delete
  to authenticated
  using (
    exists (
      select 1 from public.assets
      join public.shoots on shoots.id = assets.shoot_id
      join public.amazon_products on amazon_products.id = amazon_media_links.amazon_product_id
      join public.amazon_connections on amazon_connections.seller_id = amazon_products.seller_id
      where assets.id = amazon_media_links.asset_id
      and (shoots.designer_id = auth.uid() or amazon_connections.user_id = auth.uid())
    )
  );
;
