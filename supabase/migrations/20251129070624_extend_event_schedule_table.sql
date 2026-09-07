-- ============================================================================
-- Migration: Extend Event Schedule Table for Fashion Show Planner
-- Purpose: Add missing columns required by fashion show planning system
-- Affected: public.event_schedule table
-- Dependencies: schedule_type enum, public.stakeholders, public.model_profiles, public.fashion_show_designer_profiles
-- ============================================================================

-- Add schedule_type column
alter table public.event_schedule
  add column if not exists schedule_type schedule_type;

-- Add date column (separate from start_time for date-only queries)
alter table public.event_schedule
  add column if not exists date date;

-- Extract date from start_time if date is null
update public.event_schedule
  set date = start_time::date
  where date is null and start_time is not null;

-- Add time columns (separate from timestamptz for time-only queries)
alter table public.event_schedule
  add column if not exists start_time_only time;

alter table public.event_schedule
  add column if not exists end_time_only time;

-- Extract time from timestamptz if time columns are null
update public.event_schedule
  set start_time_only = start_time::time
  where start_time_only is null and start_time is not null;

update public.event_schedule
  set end_time_only = end_time::time
  where end_time_only is null and end_time is not null;

-- Add stakeholder_id column (for linking to stakeholders)
alter table public.event_schedule
  add column if not exists stakeholder_id uuid references public.stakeholders(id) on delete set null;

-- Add model_id column (for linking to model profiles)
alter table public.event_schedule
  add column if not exists model_id uuid references public.model_profiles(id) on delete set null;

-- Add designer_id column (for linking to designer profiles)
-- Note: Using fashion_show_designer_profiles if it exists, otherwise may need to reference existing designer_profiles
alter table public.event_schedule
  add column if not exists designer_id uuid;

-- Comments
comment on column public.event_schedule.schedule_type is 'Type of schedule item (rehearsal, fitting, runway_show, etc.)';
comment on column public.event_schedule.date is 'Date of schedule item (separate from start_time for date-only queries)';
comment on column public.event_schedule.start_time_only is 'Start time (time only, separate from timestamptz)';
comment on column public.event_schedule.end_time_only is 'End time (time only, separate from timestamptz)';
comment on column public.event_schedule.stakeholder_id is 'Stakeholder assigned to this schedule item';
comment on column public.event_schedule.model_id is 'Model assigned to this schedule item';
comment on column public.event_schedule.designer_id is 'Designer assigned to this schedule item';

-- Indexes
create index if not exists idx_event_schedule_schedule_type 
  on public.event_schedule(schedule_type) 
  where schedule_type is not null;

create index if not exists idx_event_schedule_date 
  on public.event_schedule(date) 
  where date is not null;

create index if not exists idx_event_schedule_stakeholder_id 
  on public.event_schedule(stakeholder_id) 
  where stakeholder_id is not null;

create index if not exists idx_event_schedule_model_id 
  on public.event_schedule(model_id) 
  where model_id is not null;

create index if not exists idx_event_schedule_designer_id 
  on public.event_schedule(designer_id) 
  where designer_id is not null;
;
