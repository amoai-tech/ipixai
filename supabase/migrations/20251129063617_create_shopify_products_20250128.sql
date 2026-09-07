-- ============================================================================
-- Migration: Create Shopify Products Table
-- Purpose: Store synced Shopify product data
-- Affected: public.shopify_products table
-- Dependencies: public.shopify_shops
-- ============================================================================

-- Shopify products: Synced product listings from Shopify
create table if not exists public.shopify_products (
  id uuid default uuid_generate_v4() primary key,
  shop_id uuid references public.shopify_shops(id) on delete cascade not null,
  
  -- Shopify product info
  shopify_product_id text not null, -- Shopify's product ID
  shopify_variant_id text, -- Primary variant ID
  title text not null,
  handle text, -- URL slug
  product_type text,
  vendor text,
  tags text[],
  status text, -- 'active', 'archived', 'draft'
  
  -- Media (stored as JSONB for flexibility)
  images jsonb, -- Array of image objects from Shopify
  
  -- Content
  description text,
  
  -- Sync metadata
  synced_at timestamptz,
  
  -- Timestamps
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  
  unique(shop_id, shopify_product_id)
);

comment on table public.shopify_products is 'Synced Shopify product listings';

-- Indexes for performance
create index if not exists idx_shopify_products_shop_id on public.shopify_products(shop_id);
create index if not exists idx_shopify_products_shopify_id on public.shopify_products(shopify_product_id);
create index if not exists idx_shopify_products_status on public.shopify_products(status);

-- Enable RLS
alter table public.shopify_products enable row level security;

-- Drop existing policies if they exist
drop policy if exists "anon_select_shopify_products" on public.shopify_products;
drop policy if exists "authenticated_select_shopify_products" on public.shopify_products;
drop policy if exists "authenticated_insert_shopify_products" on public.shopify_products;
drop policy if exists "authenticated_update_shopify_products" on public.shopify_products;

-- RLS Policies: Users can view products from their own shops
-- Anonymous users: No access
create policy "anon_select_shopify_products"
  on public.shopify_products for select
  to anon
  using (false);

-- Authenticated users can view products from their own shops
create policy "authenticated_select_shopify_products"
  on public.shopify_products for select
  to authenticated
  using (
    exists (
      select 1 from public.shopify_shops
      where shopify_shops.id = shopify_products.shop_id
      and shopify_shops.user_id = auth.uid()
    )
  );

-- Authenticated users can insert products for their own shops
create policy "authenticated_insert_shopify_products"
  on public.shopify_products for insert
  to authenticated
  with check (
    exists (
      select 1 from public.shopify_shops
      where shopify_shops.id = shopify_products.shop_id
      and shopify_shops.user_id = auth.uid()
    )
  );

-- Authenticated users can update products from their own shops
create policy "authenticated_update_shopify_products"
  on public.shopify_products for update
  to authenticated
  using (
    exists (
      select 1 from public.shopify_shops
      where shopify_shops.id = shopify_products.shop_id
      and shopify_shops.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.shopify_shops
      where shopify_shops.id = shopify_products.shop_id
      and shopify_shops.user_id = auth.uid()
    )
  );
;
