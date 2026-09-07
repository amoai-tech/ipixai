-- ============================================================================
-- Migration: Extend Organizer Teams Table for Fashion Show Planner
-- Purpose: Add missing columns required by fashion show planning system
-- Affected: public.organizer_teams table
-- Dependencies: auth.users, organizer_type enum
-- ============================================================================

-- Add created_by column (for fashion show planner compatibility)
alter table public.organizer_teams
  add column if not exists created_by uuid references auth.users(id) on delete set null;

-- Set created_by from owner_id if created_by is null
update public.organizer_teams
  set created_by = owner_id
  where created_by is null;

-- Add type column (organizer_type enum)
alter table public.organizer_teams
  add column if not exists type organizer_type default 'freelance_collective';

-- Add website_url column
alter table public.organizer_teams
  add column if not exists website_url text;

-- Add contact_email column
alter table public.organizer_teams
  add column if not exists contact_email text;

-- Add contact_phone column
alter table public.organizer_teams
  add column if not exists contact_phone text;

-- Comments
comment on column public.organizer_teams.created_by is 'User who created this organizer team';
comment on column public.organizer_teams.type is 'Type of organizing organization (agency, production_house, etc.)';
comment on column public.organizer_teams.website_url is 'Website URL for the organizer team';
comment on column public.organizer_teams.contact_email is 'Contact email for the organizer team';
comment on column public.organizer_teams.contact_phone is 'Contact phone for the organizer team';

-- Indexes
create index if not exists idx_organizer_teams_created_by 
  on public.organizer_teams(created_by) 
  where created_by is not null;

create index if not exists idx_organizer_teams_type 
  on public.organizer_teams(type);
;
