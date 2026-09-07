-- ============================================
-- Migration: Create Fashion Brands and Designers Tables
-- Created: 2025-01-25
-- Purpose: Create fashion_brands and event_designers tables
-- Dependencies: 20250125000002_create_events_core.sql
-- ============================================

-- ============================================
-- FASHION BRANDS TABLE
-- ============================================

-- Fashion brands stores brand/designer house records
-- Reusable database of fashion brands
create table fashion_brands (
  id uuid default gen_random_uuid() primary key,
  
  name text not null,
  description text,
  website_url text,
  logo_url text,
  
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
comment on table fashion_brands is 'Fashion brand and designer house records. Reusable database of brands participating in events.';
-- Enable row level security
alter table fashion_brands enable row level security;
-- ============================================
-- EVENT DESIGNERS TABLE
-- ============================================

-- Event designers links brands/designers to specific events
-- Tracks which designers are showcasing at each event
create table event_designers (
  id uuid default gen_random_uuid() primary key,
  event_id uuid references events(id) on delete cascade not null,
  brand_id uuid references fashion_brands(id) on delete set null,
  
  -- If brand not registered, store designer name directly
  designer_name text, -- If brand_id is null
  collection_name text,
  
  created_at timestamptz default now(),
  
  -- One designer per brand per event
  unique(event_id, brand_id)
);
comment on table event_designers is 'Designer/brand assignments for events. Links fashion brands to events with collection information.';
-- Enable row level security
alter table event_designers enable row level security;
-- ============================================
-- RLS POLICIES FOR FASHION BRANDS
-- ============================================

-- Public can view fashion brands (for directory)
create policy "anon can view fashion brands"
  on fashion_brands for select
  to anon
  using (true);
-- Authenticated can view fashion brands
create policy "authenticated can view fashion brands"
  on fashion_brands for select
  to authenticated
  using (true);
-- Authenticated users can insert brands
create policy "authenticated can insert fashion brands"
  on fashion_brands for insert
  to authenticated
  with check (true);
-- Authenticated users can update brands
create policy "authenticated can update fashion brands"
  on fashion_brands for update
  to authenticated
  using (true)
  with check (true);
-- Authenticated users can delete brands
create policy "authenticated can delete fashion brands"
  on fashion_brands for delete
  to authenticated
  using (true);
-- ============================================
-- RLS POLICIES FOR EVENT DESIGNERS
-- ============================================

-- Public can view designers for published events
create policy "anon can view published event designers"
  on event_designers for select
  to anon
  using (
    exists (
      select 1 from events
      where events.id = event_designers.event_id
      and events.status = 'published'
      and events.is_public = true
    )
  );
-- Authenticated can view designers for published events
create policy "authenticated can view published event designers"
  on event_designers for select
  to authenticated
  using (
    exists (
      select 1 from events
      where events.id = event_designers.event_id
      and events.status = 'published'
      and events.is_public = true
    )
  );
-- Organizers can view designers for their events
create policy "organizers can view event designers"
  on event_designers for select
  to authenticated
  using (
    exists (
      select 1 from events
      where events.id = event_designers.event_id
      and events.organizer_id = auth.uid()
    )
  );
-- Organizers can insert designers for their events
create policy "organizers can insert event designers"
  on event_designers for insert
  to authenticated
  with check (
    exists (
      select 1 from events
      where events.id = event_designers.event_id
      and events.organizer_id = auth.uid()
    )
  );
-- Organizers can update designers for their events
create policy "organizers can update event designers"
  on event_designers for update
  to authenticated
  using (
    exists (
      select 1 from events
      where events.id = event_designers.event_id
      and events.organizer_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from events
      where events.id = event_designers.event_id
      and events.organizer_id = auth.uid()
    )
  );
-- Organizers can delete designers for their events
create policy "organizers can delete event designers"
  on event_designers for delete
  to authenticated
  using (
    exists (
      select 1 from events
      where events.id = event_designers.event_id
      and events.organizer_id = auth.uid()
    )
  );
-- ============================================
-- INDEXES FOR BRANDS AND DESIGNERS
-- ============================================

-- Index for event designer lookups
create index idx_event_designers_event on event_designers(event_id);
-- Index for brand lookups
create index idx_event_designers_brand on event_designers(brand_id) where brand_id is not null;
