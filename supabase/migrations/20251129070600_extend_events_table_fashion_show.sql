-- ============================================================================
-- Migration: Extend Events Table for Fashion Show Planner
-- Purpose: Add missing columns required by fashion show planning system
-- Affected: public.events table
-- Dependencies: public.organizer_teams, auth.users
-- ============================================================================

-- Add created_by column (for fashion show planner compatibility)
alter table public.events
  add column if not exists created_by uuid references auth.users(id) on delete set null;

-- Set created_by from organizer_id if created_by is null
update public.events
  set created_by = organizer_id
  where created_by is null;

-- Add organizer_team_id column
alter table public.events
  add column if not exists organizer_team_id uuid references public.organizer_teams(id) on delete set null;

-- Add event_type column
alter table public.events
  add column if not exists event_type text default 'runway';

-- Add event_date column (date only, separate from start_time)
alter table public.events
  add column if not exists event_date date;

-- Extract date from start_time if event_date is null
update public.events
  set event_date = start_time::date
  where event_date is null and start_time is not null;

-- Add cover_image_url column
alter table public.events
  add column if not exists cover_image_url text;

-- Comments
comment on column public.events.created_by is 'User who created the event (fashion show planner compatibility)';
comment on column public.events.organizer_team_id is 'Organizer team managing this event';
comment on column public.events.event_type is 'Type of event (runway, pop-up, exhibition, etc.)';
comment on column public.events.event_date is 'Event date (separate from start_time for date-only queries)';
comment on column public.events.cover_image_url is 'Cover image URL for event display';

-- Indexes
create index if not exists idx_events_created_by 
  on public.events(created_by) 
  where created_by is not null;

create index if not exists idx_events_organizer_team_id 
  on public.events(organizer_team_id) 
  where organizer_team_id is not null;

create index if not exists idx_events_event_date 
  on public.events(event_date) 
  where event_date is not null;

create index if not exists idx_events_event_type 
  on public.events(event_type);
;
