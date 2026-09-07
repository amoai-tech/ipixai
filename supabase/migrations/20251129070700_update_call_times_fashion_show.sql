-- ============================================================================
-- Migration: Update Call Times Table for Fashion Show Planner
-- Purpose: Add missing columns to match fashion show planner schema
-- Affected: public.call_times table
-- Dependencies: public.model_profiles, public.fashion_show_designer_profiles
-- ============================================================================

-- Add date column (separate from call_time timestamptz)
alter table public.call_times
  add column if not exists date date;

-- Extract date from call_time if date is null
update public.call_times
  set date = call_time::date
  where date is null and call_time is not null;

-- Add time column (separate from call_time timestamptz)
alter table public.call_times
  add column if not exists time time;

-- Extract time from call_time if time is null
update public.call_times
  set time = call_time::time
  where time is null and call_time is not null;

-- Add model_id column (for linking to model profiles)
-- Note: Current schema uses model_profile_id, but fashion show planner expects model_id
-- We'll add model_id as an alias/reference
alter table public.call_times
  add column if not exists model_id uuid references public.model_profiles(id) on delete set null;

-- Migrate from model_profile_id to model_id if model_profile_id exists
update public.call_times
set model_id = model_profile_id
where model_id is null and model_profile_id is not null;

-- Add designer_id column (for linking to designer profiles)
alter table public.call_times
  add column if not exists designer_id uuid;

-- Comments
comment on column public.call_times.date is 'Date of call time (separate from call_time timestamptz)';
comment on column public.call_times.time is 'Time of call time (separate from call_time timestamptz)';
comment on column public.call_times.model_id is 'Model assigned to this call time (alias for model_profile_id)';
comment on column public.call_times.designer_id is 'Designer assigned to this call time';

-- Indexes
create index if not exists idx_call_times_date 
  on public.call_times(date) 
  where date is not null;

create index if not exists idx_call_times_model_id 
  on public.call_times(model_id) 
  where model_id is not null;

create index if not exists idx_call_times_designer_id 
  on public.call_times(designer_id) 
  where designer_id is not null;
;
