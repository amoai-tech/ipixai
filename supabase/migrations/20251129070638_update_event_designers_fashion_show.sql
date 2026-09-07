-- ============================================================================
-- Migration: Update Event Designers for Fashion Show Planner
-- Purpose: Add missing columns and fix foreign key references
-- Affected: public.event_designers table
-- Dependencies: public.fashion_show_designer_profiles (if exists), public.fashion_brands
-- ============================================================================

-- Add designer_id column (references fashion_show_designer_profiles)
-- Note: Foreign key will be added in a separate migration after fashion_show_designer_profiles is created
alter table public.event_designers
  add column if not exists designer_id uuid;

-- Add is_primary_designer column
alter table public.event_designers
  add column if not exists is_primary_designer boolean default true;

-- Comments
comment on column public.event_designers.designer_id is 'Designer profile ID (references fashion_show_designer_profiles when available)';
comment on column public.event_designers.is_primary_designer is 'Whether this is the primary designer for the event';

-- Index
create index if not exists idx_event_designers_designer_id 
  on public.event_designers(designer_id) 
  where designer_id is not null;

-- Note: Foreign key constraint for designer_id will be added after fashion_show_designer_profiles table is created
-- This migration prepares the column structure
;
