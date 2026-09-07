-- ============================================================================
-- Migration: Create Shopify Media Links Table
-- Purpose: Map FashionOS assets to Shopify product media
-- Affected: public.shopify_media_links table
-- Dependencies: public.assets, public.shopify_products
-- ============================================================================

-- Shopify media links: Maps FashionOS assets to Shopify product media
create table if not exists public.shopify_media_links (
  id uuid default uuid_generate_v4() primary key,
  asset_id uuid references public.assets(id) on delete cascade not null,
  shopify_product_id uuid references public.shopify_products(id) on delete cascade not null,
  
  -- Shopify media info
  shopify_media_id text, -- Shopify's media ID after upload
  
  -- Export metadata
  exported_at timestamptz default now() not null,
  
  -- Timestamps
  created_at timestamptz default now() not null,
  
  unique(asset_id, shopify_product_id)
);

comment on table public.shopify_media_links is 'Maps FashionOS assets to Shopify product media';

-- Indexes for performance
create index if not exists idx_shopify_media_links_asset on public.shopify_media_links(asset_id);
create index if not exists idx_shopify_media_links_product on public.shopify_media_links(shopify_product_id);
create index if not exists idx_shopify_media_links_shopify_media_id on public.shopify_media_links(shopify_media_id) where shopify_media_id is not null;

-- Enable RLS
alter table public.shopify_media_links enable row level security;

-- Drop existing policies if they exist
drop policy if exists "anon_select_shopify_media_links" on public.shopify_media_links;
drop policy if exists "authenticated_select_shopify_media_links" on public.shopify_media_links;
drop policy if exists "authenticated_insert_shopify_media_links" on public.shopify_media_links;
drop policy if exists "authenticated_update_shopify_media_links" on public.shopify_media_links;
drop policy if exists "authenticated_delete_shopify_media_links" on public.shopify_media_links;

-- RLS Policies: Users can view links for their own assets and products
-- Anonymous users: No access
create policy "anon_select_shopify_media_links"
  on public.shopify_media_links for select
  to anon
  using (false);

-- Authenticated users can view links for their own assets and products
create policy "authenticated_select_shopify_media_links"
  on public.shopify_media_links for select
  to authenticated
  using (
    exists (
      select 1 from public.assets
      join public.shoots on shoots.id = assets.shoot_id
      join public.shopify_products on shopify_products.id = shopify_media_links.shopify_product_id
      join public.shopify_shops on shopify_shops.id = shopify_products.shop_id
      where assets.id = shopify_media_links.asset_id
      and (shoots.designer_id = auth.uid() or shopify_shops.user_id = auth.uid())
    )
  );

-- Authenticated users can create links for their own assets and products
create policy "authenticated_insert_shopify_media_links"
  on public.shopify_media_links for insert
  to authenticated
  with check (
    exists (
      select 1 from public.assets
      join public.shoots on shoots.id = assets.shoot_id
      join public.shopify_products on shopify_products.id = shopify_media_links.shopify_product_id
      join public.shopify_shops on shopify_shops.id = shopify_products.shop_id
      where assets.id = shopify_media_links.asset_id
      and (shoots.designer_id = auth.uid() or shopify_shops.user_id = auth.uid())
    )
  );

-- Authenticated users can update links for their own assets and products
create policy "authenticated_update_shopify_media_links"
  on public.shopify_media_links for update
  to authenticated
  using (
    exists (
      select 1 from public.assets
      join public.shoots on shoots.id = assets.shoot_id
      join public.shopify_products on shopify_products.id = shopify_media_links.shopify_product_id
      join public.shopify_shops on shopify_shops.id = shopify_products.shop_id
      where assets.id = shopify_media_links.asset_id
      and (shoots.designer_id = auth.uid() or shopify_shops.user_id = auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.assets
      join public.shoots on shoots.id = assets.shoot_id
      join public.shopify_products on shopify_products.id = shopify_media_links.shopify_product_id
      join public.shopify_shops on shopify_shops.id = shopify_products.shop_id
      where assets.id = shopify_media_links.asset_id
      and (shoots.designer_id = auth.uid() or shopify_shops.user_id = auth.uid())
    )
  );

-- Authenticated users can delete links for their own assets and products
create policy "authenticated_delete_shopify_media_links"
  on public.shopify_media_links for delete
  to authenticated
  using (
    exists (
      select 1 from public.assets
      join public.shoots on shoots.id = assets.shoot_id
      join public.shopify_products on shopify_products.id = shopify_media_links.shopify_product_id
      join public.shopify_shops on shopify_shops.id = shopify_products.shop_id
      where assets.id = shopify_media_links.asset_id
      and (shoots.designer_id = auth.uid() or shopify_shops.user_id = auth.uid())
    )
  );
;
