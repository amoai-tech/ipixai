-- ============================================================================
-- Migration: Create Amazon Products Table
-- Purpose: Store synced Amazon product listings
-- Affected: public.amazon_products table
-- Dependencies: public.amazon_connections (via seller_id)
-- ============================================================================

-- Amazon products: Synced product listings from Amazon Seller Central
create table if not exists public.amazon_products (
  id uuid default uuid_generate_v4() primary key,
  seller_id text not null, -- References amazon_connections.seller_id (not FK to allow flexibility)
  
  -- Amazon product info
  sku text not null,
  asin text,
  title text,
  images jsonb, -- Array of image URLs
  
  -- Status
  status text, -- 'active', 'inactive', 'suppressed'
  
  -- Sync metadata
  synced_at timestamptz,
  
  -- Timestamps
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  
  unique(seller_id, sku)
);

comment on table public.amazon_products is 'Synced Amazon product listings';

-- Indexes for performance
create index if not exists idx_amazon_products_seller_id on public.amazon_products(seller_id);
create index if not exists idx_amazon_products_sku on public.amazon_products(sku);
create index if not exists idx_amazon_products_asin on public.amazon_products(asin) where asin is not null;
create index if not exists idx_amazon_products_status on public.amazon_products(status);

-- Enable RLS
alter table public.amazon_products enable row level security;

-- Drop existing policies if they exist
drop policy if exists "anon_select_amazon_products" on public.amazon_products;
drop policy if exists "authenticated_select_amazon_products" on public.amazon_products;
drop policy if exists "authenticated_insert_amazon_products" on public.amazon_products;
drop policy if exists "authenticated_update_amazon_products" on public.amazon_products;

-- RLS Policies: Users can view products from their own seller accounts
-- Anonymous users: No access
create policy "anon_select_amazon_products"
  on public.amazon_products for select
  to anon
  using (false);

-- Authenticated users can view products from their own seller accounts
create policy "authenticated_select_amazon_products"
  on public.amazon_products for select
  to authenticated
  using (
    exists (
      select 1 from public.amazon_connections
      where amazon_connections.seller_id = amazon_products.seller_id
      and amazon_connections.user_id = auth.uid()
    )
  );

-- Authenticated users can insert products for their own seller accounts
create policy "authenticated_insert_amazon_products"
  on public.amazon_products for insert
  to authenticated
  with check (
    exists (
      select 1 from public.amazon_connections
      where amazon_connections.seller_id = amazon_products.seller_id
      and amazon_connections.user_id = auth.uid()
    )
  );

-- Authenticated users can update products from their own seller accounts
create policy "authenticated_update_amazon_products"
  on public.amazon_products for update
  to authenticated
  using (
    exists (
      select 1 from public.amazon_connections
      where amazon_connections.seller_id = amazon_products.seller_id
      and amazon_connections.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.amazon_connections
      where amazon_connections.seller_id = amazon_products.seller_id
      and amazon_connections.user_id = auth.uid()
    )
  );
;
