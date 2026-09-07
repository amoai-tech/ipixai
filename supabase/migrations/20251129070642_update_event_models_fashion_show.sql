-- ============================================================================
-- Migration: Update Event Models for Fashion Show Planner
-- Purpose: Add missing columns for fashion show planning
-- Affected: public.event_models table
-- Dependencies: None (columns already exist, just ensuring compatibility)
-- ============================================================================

-- Ensure is_opening and is_closing columns exist
alter table public.event_models
  add column if not exists is_opening boolean default false;

alter table public.event_models
  add column if not exists is_closing boolean default false;

-- Comments
comment on column public.event_models.is_opening is 'Whether this model opens the show';
comment on column public.event_models.is_closing is 'Whether this model closes the show';

-- Indexes
create index if not exists idx_event_models_is_opening 
  on public.event_models(is_opening) 
  where is_opening = true;

create index if not exists idx_event_models_is_closing 
  on public.event_models(is_closing) 
  where is_closing = true;
;
