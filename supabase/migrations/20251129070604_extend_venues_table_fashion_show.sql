-- ============================================================================
-- Migration: Extend Venues Table for Fashion Show Planner
-- Purpose: Add missing columns required by fashion show planning system
-- Affected: public.venues table
-- Dependencies: auth.users, venue_type enum, indoor_outdoor enum
-- ============================================================================

-- Add created_by column (for fashion show planner compatibility)
alter table public.venues
  add column if not exists created_by uuid references auth.users(id) on delete set null;

-- Set created_by from owner_id if created_by is null
update public.venues
  set created_by = owner_id
  where created_by is null and owner_id is not null;

-- Add type column (venue_type enum)
alter table public.venues
  add column if not exists type venue_type;

-- Add indoor_outdoor column
alter table public.venues
  add column if not exists indoor_outdoor indoor_outdoor default 'indoor';

-- Add contact_name column
alter table public.venues
  add column if not exists contact_name text;

-- Add contact_email column
alter table public.venues
  add column if not exists contact_email text;

-- Add contact_phone column
alter table public.venues
  add column if not exists contact_phone text;

-- Add notes column
alter table public.venues
  add column if not exists notes text;

-- Comments
comment on column public.venues.created_by is 'User who created this venue record';
comment on column public.venues.type is 'Type of venue (runway, gallery, hotel, etc.)';
comment on column public.venues.indoor_outdoor is 'Whether venue is indoor, outdoor, or mixed';
comment on column public.venues.contact_name is 'Primary contact name for venue';
comment on column public.venues.contact_email is 'Primary contact email for venue';
comment on column public.venues.contact_phone is 'Primary contact phone for venue';
comment on column public.venues.notes is 'Additional notes about the venue';

-- Indexes
create index if not exists idx_venues_created_by 
  on public.venues(created_by) 
  where created_by is not null;

create index if not exists idx_venues_type 
  on public.venues(type) 
  where type is not null;
;
