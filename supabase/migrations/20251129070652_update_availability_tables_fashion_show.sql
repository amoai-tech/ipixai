-- ============================================================================
-- Migration: Update Availability Tables for Fashion Show Planner
-- Purpose: Add status column and fix schema for fashion show planning
-- Affected: public.venue_availability, public.model_availability, public.designer_availability
-- Dependencies: availability_status enum
-- ============================================================================

-- VENUE AVAILABILITY
-- Add status column if not exists
alter table public.venue_availability
  add column if not exists status availability_status default 'available';

-- Add date column if not exists (separate from start_time)
alter table public.venue_availability
  add column if not exists date date;

-- Extract date from start_time if date is null
update public.venue_availability
  set date = start_time::date
  where date is null and start_time is not null;

-- Add time columns if not exists
alter table public.venue_availability
  add column if not exists start_time_only time;

alter table public.venue_availability
  add column if not exists end_time_only time;

-- Extract time from timestamptz if time columns are null
update public.venue_availability
  set start_time_only = start_time::time
  where start_time_only is null and start_time is not null;

update public.venue_availability
  set end_time_only = end_time::time
  where end_time_only is null and end_time is not null;

-- Comments
comment on column public.venue_availability.status is 'Availability status (available, reserved, booked, etc.)';
comment on column public.venue_availability.date is 'Date of availability (separate from start_time)';
comment on column public.venue_availability.start_time_only is 'Start time (time only)';
comment on column public.venue_availability.end_time_only is 'End time (time only)';

-- Indexes
create index if not exists idx_venue_availability_status 
  on public.venue_availability(status);

create index if not exists idx_venue_availability_date 
  on public.venue_availability(date) 
  where date is not null;

-- MODEL AVAILABILITY
-- Add status column if not exists
alter table public.model_availability
  add column if not exists status availability_status default 'available';

-- Add date column if not exists
alter table public.model_availability
  add column if not exists date date;

-- Extract date from start_time if date is null
update public.model_availability
  set date = start_time::date
  where date is null and start_time is not null;

-- Add time columns if not exists
alter table public.model_availability
  add column if not exists start_time_only time;

alter table public.model_availability
  add column if not exists end_time_only time;

-- Extract time from timestamptz if time columns are null
update public.model_availability
  set start_time_only = start_time::time
  where start_time_only is null and start_time is not null;

update public.model_availability
  set end_time_only = end_time::time
  where end_time_only is null and end_time is not null;

-- Comments
comment on column public.model_availability.status is 'Availability status (available, reserved, booked, etc.)';
comment on column public.model_availability.date is 'Date of availability (separate from start_time)';
comment on column public.model_availability.start_time_only is 'Start time (time only)';
comment on column public.model_availability.end_time_only is 'End time (time only)';

-- Indexes
create index if not exists idx_model_availability_status 
  on public.model_availability(status);

create index if not exists idx_model_availability_date 
  on public.model_availability(date) 
  where date is not null;

-- DESIGNER AVAILABILITY
-- Add status column if not exists
alter table public.designer_availability
  add column if not exists status availability_status default 'available';

-- Add date column if not exists
alter table public.designer_availability
  add column if not exists date date;

-- Extract date from start_time if date is null
update public.designer_availability
  set date = start_time::date
  where date is null and start_time is not null;

-- Add time columns if not exists
alter table public.designer_availability
  add column if not exists start_time_only time;

alter table public.designer_availability
  add column if not exists end_time_only time;

-- Extract time from timestamptz if time columns are null
update public.designer_availability
  set start_time_only = start_time::time
  where start_time_only is null and start_time is not null;

update public.designer_availability
  set end_time_only = end_time::time
  where end_time_only is null and end_time is not null;

-- Comments
comment on column public.designer_availability.status is 'Availability status (available, reserved, booked, etc.)';
comment on column public.designer_availability.date is 'Date of availability (separate from start_time)';
comment on column public.designer_availability.start_time_only is 'Start time (time only)';
comment on column public.designer_availability.end_time_only is 'End time (time only)';

-- Indexes
create index if not exists idx_designer_availability_status 
  on public.designer_availability(status);

create index if not exists idx_designer_availability_date 
  on public.designer_availability(date) 
  where date is not null;
;
