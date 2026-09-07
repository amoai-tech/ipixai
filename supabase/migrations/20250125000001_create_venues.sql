-- ============================================
-- Migration: Create Venues Table
-- Created: 2025-01-25
-- Purpose: Create reusable venue database for events
-- Dependencies: None (foundation table)
-- ============================================

-- ============================================
-- VENUES TABLE
-- ============================================

-- Venues table stores reusable location information
-- Can be linked to multiple events
create table venues (
  id uuid default gen_random_uuid() primary key,
  owner_id uuid references auth.users(id),
  
  -- Basic information
  name text not null,
  description text,
  address text,
  city text not null,
  country text,
  capacity integer,
  
  -- Geographic coordinates for mapping
  geo_lat float,
  geo_lng float,
  
  -- Venue features/amenities
  -- Array of amenities like ['wifi', 'parking', 'accessible', 'backstage', 'dressing_rooms']
  amenities text[],
  
  -- Metadata
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
comment on table venues is 'Reusable venue database for fashion events. Stores location, capacity, and amenities information.';
-- Enable row level security
alter table venues enable row level security;
-- ============================================
-- RLS POLICIES FOR VENUES
-- ============================================

-- Public can view all venues (for event listings)
create policy "anon can view venues"
  on venues for select
  to anon
  using (true);
-- Authenticated users can view all venues
create policy "authenticated can view venues"
  on venues for select
  to authenticated
  using (true);
-- Venue owners can insert new venues
create policy "authenticated can insert venues"
  on venues for insert
  to authenticated
  with check (auth.uid() = owner_id or owner_id is null);
-- Venue owners can update their venues
create policy "owners can update venues"
  on venues for update
  to authenticated
  using (auth.uid() = owner_id or owner_id is null)
  with check (auth.uid() = owner_id or owner_id is null);
-- Venue owners can delete their venues
create policy "owners can delete venues"
  on venues for delete
  to authenticated
  using (auth.uid() = owner_id);
-- ============================================
-- INDEXES FOR VENUES
-- ============================================

-- Index for city-based searches
create index idx_venues_city on venues(city);
-- Index for owner lookups
create index idx_venues_owner on venues(owner_id) where owner_id is not null;
-- Index for geographic searches (if using PostGIS in future)
-- create index idx_venues_geo on venues using gist (point(geo_lng, geo_lat));;
