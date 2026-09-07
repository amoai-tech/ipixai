-- ============================================
-- Migration: Create Event Assets Table
-- Created: 2025-01-25
-- Purpose: Store media files (images, videos, documents) associated with events
-- Dependencies: 20250125000002_create_events_core.sql
-- ============================================

-- ============================================
-- EVENT ASSETS TABLE
-- ============================================

-- Event assets stores media files associated with events
-- Types: images (banners, photos), videos (Veo trailers), documents (contracts, PDFs)
create table event_assets (
  id uuid default gen_random_uuid() primary key,
  event_id uuid references events(id) on delete cascade not null,
  
  -- Asset information
  type text not null check (type in ('image', 'video', 'document')),
  url text not null, -- Supabase Storage URL or external URL
  alt_text text, -- Accessibility: alt text for images
  
  -- Display and organization
  is_featured boolean default false, -- Featured assets shown prominently
  
  -- For AI-generated assets (Veo videos, Gemini images)
  generation_prompt text, -- Original prompt used for generation
  generation_status text, -- 'pending', 'processing', 'completed', 'failed'
  
  created_at timestamptz default now()
);
comment on table event_assets is 'Media files associated with events. Stores images (banners, photos), videos (Veo trailers), and documents (contracts, PDFs). Supports AI-generated assets.';
-- Enable row level security
alter table event_assets enable row level security;
-- ============================================
-- RLS POLICIES FOR EVENT ASSETS
-- ============================================

-- Public can view featured assets for published events
create policy "anon can view featured event assets"
  on event_assets for select
  to anon
  using (
    is_featured = true
    and exists (
      select 1 from events
      where events.id = event_assets.event_id
      and events.status = 'published'
      and events.is_public = true
    )
  );
-- Authenticated can view featured assets for published events
create policy "authenticated can view featured event assets"
  on event_assets for select
  to authenticated
  using (
    is_featured = true
    and exists (
      select 1 from events
      where events.id = event_assets.event_id
      and events.status = 'published'
      and events.is_public = true
    )
  );
-- Organizers can view all assets for their events
create policy "organizers can view event assets"
  on event_assets for select
  to authenticated
  using (
    exists (
      select 1 from events
      where events.id = event_assets.event_id
      and events.organizer_id = auth.uid()
    )
  );
-- Organizers can insert assets for their events
create policy "organizers can insert event assets"
  on event_assets for insert
  to authenticated
  with check (
    exists (
      select 1 from events
      where events.id = event_assets.event_id
      and events.organizer_id = auth.uid()
    )
  );
-- Organizers can update assets for their events
create policy "organizers can update event assets"
  on event_assets for update
  to authenticated
  using (
    exists (
      select 1 from events
      where events.id = event_assets.event_id
      and events.organizer_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from events
      where events.id = event_assets.event_id
      and events.organizer_id = auth.uid()
    )
  );
-- Organizers can delete assets for their events
create policy "organizers can delete event assets"
  on event_assets for delete
  to authenticated
  using (
    exists (
      select 1 from events
      where events.id = event_assets.event_id
      and events.organizer_id = auth.uid()
    )
  );
-- ============================================
-- INDEXES FOR EVENT ASSETS
-- ============================================

-- Index for event asset lookups
create index idx_event_assets_event on event_assets(event_id);
-- Index for featured assets (public listings)
create index idx_event_assets_featured on event_assets(event_id, is_featured) where is_featured = true;
-- Index for asset type filtering
create index idx_event_assets_type on event_assets(type);
