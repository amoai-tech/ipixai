-- ============================================
-- Migration: Create Scheduling and Availability Tables
-- Created: 2025-01-25
-- Purpose: Create event_schedule, call_times, and availability tables for conflict detection
-- Dependencies: 20250125000002_create_events_core.sql, 20250125000001_create_venues.sql, 20250125000007_create_casting_system.sql, 20250125000008_create_brands_designers.sql
-- ============================================

-- ============================================
-- EVENT SCHEDULE TABLE (Master Run of Show)
-- ============================================

-- Event schedule stores the master run of show for event day
-- Detailed timeline with assigned stakeholders and models
create table event_schedule (
  id uuid default gen_random_uuid() primary key,
  event_id uuid references events(id) on delete cascade not null,
  
  -- Schedule item details
  title text not null,
  description text,
  start_time timestamptz not null,
  end_time timestamptz,
  
  -- Location and assignments
  location text,
  assigned_stakeholders uuid[], -- Array of stakeholder IDs
  assigned_models uuid[], -- Array of model_profile IDs
  
  created_at timestamptz default now()
);
comment on table event_schedule is 'Master run of show for event day. Detailed timeline with assigned stakeholders and models for each schedule item.';
-- Enable row level security
alter table event_schedule enable row level security;
-- ============================================
-- CALL TIMES TABLE
-- ============================================

-- Call times stores specific call times for models and crew
-- Links to schedule items and tracks individual call times
create table call_times (
  id uuid default gen_random_uuid() primary key,
  event_id uuid references events(id) on delete cascade not null,
  schedule_item_id uuid references event_schedule(id) on delete cascade,
  
  -- Assignment (either model or stakeholder)
  model_profile_id uuid references model_profiles(id) on delete cascade,
  stakeholder_id uuid references stakeholders(id) on delete cascade,
  
  -- Call time details
  call_time timestamptz not null,
  notes text,
  
  created_at timestamptz default now(),
  
  -- Ensure either model or stakeholder is set (not both)
  check (
    (model_profile_id is not null and stakeholder_id is null) or
    (model_profile_id is null and stakeholder_id is not null)
  )
);
comment on table call_times is 'Individual call times for models and crew members. Links to schedule items and tracks specific arrival times.';
-- Enable row level security
alter table call_times enable row level security;
-- ============================================
-- VENUE AVAILABILITY TABLE (Conflict Detection)
-- ============================================

-- Venue availability tracks venue bookings and blocks
-- Used for conflict detection when scheduling events
create table venue_availability (
  id uuid default gen_random_uuid() primary key,
  venue_id uuid references venues(id) on delete cascade not null,
  
  -- Time range
  start_time timestamptz not null,
  end_time timestamptz not null,
  event_id uuid references events(id) on delete set null, -- Null if blocked, set if booked
  
  notes text,
  
  created_at timestamptz default now(),
  
  -- Ensure end_time is after start_time
  check (end_time > start_time)
);
comment on table venue_availability is 'Venue availability and bookings. Tracks time ranges for conflict detection. event_id is null for blocks, set for bookings.';
-- Enable row level security
alter table venue_availability enable row level security;
-- ============================================
-- MODEL AVAILABILITY TABLE
-- ============================================

-- Model availability tracks model bookings and blocks
-- Used for conflict detection when casting models
create table model_availability (
  id uuid default gen_random_uuid() primary key,
  model_profile_id uuid references model_profiles(id) on delete cascade not null,
  
  -- Time range
  start_time timestamptz not null,
  end_time timestamptz not null,
  event_id uuid references events(id) on delete set null, -- Null if blocked, set if booked
  
  notes text,
  
  created_at timestamptz default now(),
  
  -- Ensure end_time is after start_time
  check (end_time > start_time)
);
comment on table model_availability is 'Model availability and bookings. Tracks time ranges for conflict detection when casting. event_id is null for blocks, set for bookings.';
-- Enable row level security
alter table model_availability enable row level security;
-- ============================================
-- DESIGNER AVAILABILITY TABLE
-- ============================================

-- Designer availability tracks brand/designer bookings
-- Used for conflict detection when scheduling designers
create table designer_availability (
  id uuid default gen_random_uuid() primary key,
  brand_id uuid references fashion_brands(id) on delete cascade not null,
  
  -- Time range
  start_time timestamptz not null,
  end_time timestamptz not null,
  event_id uuid references events(id) on delete set null,
  
  notes text,
  
  created_at timestamptz default now(),
  
  -- Ensure end_time is after start_time
  check (end_time > start_time)
);
comment on table designer_availability is 'Designer/brand availability and bookings. Tracks time ranges for conflict detection. event_id is null for blocks, set for bookings.';
-- Enable row level security
alter table designer_availability enable row level security;
-- ============================================
-- RLS POLICIES FOR EVENT SCHEDULE
-- ============================================

-- Public can view schedule for published events
create policy "anon can view published event schedule"
  on event_schedule for select
  to anon
  using (
    exists (
      select 1 from events
      where events.id = event_schedule.event_id
      and events.status = 'published'
      and events.is_public = true
    )
  );
-- Authenticated can view schedule for published events
create policy "authenticated can view published event schedule"
  on event_schedule for select
  to authenticated
  using (
    exists (
      select 1 from events
      where events.id = event_schedule.event_id
      and events.status = 'published'
      and events.is_public = true
    )
  );
-- Organizers can view schedule for their events
create policy "organizers can view event schedule"
  on event_schedule for select
  to authenticated
  using (
    exists (
      select 1 from events
      where events.id = event_schedule.event_id
      and events.organizer_id = auth.uid()
    )
  );
-- Organizers can insert schedule for their events
create policy "organizers can insert event schedule"
  on event_schedule for insert
  to authenticated
  with check (
    exists (
      select 1 from events
      where events.id = event_schedule.event_id
      and events.organizer_id = auth.uid()
    )
  );
-- Organizers can update schedule for their events
create policy "organizers can update event schedule"
  on event_schedule for update
  to authenticated
  using (
    exists (
      select 1 from events
      where events.id = event_schedule.event_id
      and events.organizer_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from events
      where events.id = event_schedule.event_id
      and events.organizer_id = auth.uid()
    )
  );
-- Organizers can delete schedule for their events
create policy "organizers can delete event schedule"
  on event_schedule for delete
  to authenticated
  using (
    exists (
      select 1 from events
      where events.id = event_schedule.event_id
      and events.organizer_id = auth.uid()
    )
  );
-- ============================================
-- RLS POLICIES FOR CALL TIMES
-- ============================================

-- Models can view their own call times
create policy "models can view own call times"
  on call_times for select
  to authenticated
  using (
    model_profile_id is not null
    and exists (
      select 1 from model_profiles
      where model_profiles.id = call_times.model_profile_id
      and model_profiles.profile_id = auth.uid()
    )
  );
-- Stakeholders can view their own call times
create policy "stakeholders can view own call times"
  on call_times for select
  to authenticated
  using (
    stakeholder_id is not null
    and exists (
      select 1 from stakeholders
      where stakeholders.id = call_times.stakeholder_id
      and stakeholders.profile_id = auth.uid()
    )
  );
-- Organizers can view call times for their events
create policy "organizers can view call times"
  on call_times for select
  to authenticated
  using (
    exists (
      select 1 from events
      where events.id = call_times.event_id
      and events.organizer_id = auth.uid()
    )
  );
-- Organizers can insert call times for their events
create policy "organizers can insert call times"
  on call_times for insert
  to authenticated
  with check (
    exists (
      select 1 from events
      where events.id = call_times.event_id
      and events.organizer_id = auth.uid()
    )
  );
-- Organizers can update call times for their events
create policy "organizers can update call times"
  on call_times for update
  to authenticated
  using (
    exists (
      select 1 from events
      where events.id = call_times.event_id
      and events.organizer_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from events
      where events.id = call_times.event_id
      and events.organizer_id = auth.uid()
    )
  );
-- Organizers can delete call times for their events
create policy "organizers can delete call times"
  on call_times for delete
  to authenticated
  using (
    exists (
      select 1 from events
      where events.id = call_times.event_id
      and events.organizer_id = auth.uid()
    )
  );
-- ============================================
-- RLS POLICIES FOR AVAILABILITY TABLES
-- ============================================

-- Organizers can view availability for their events
create policy "organizers can view venue availability"
  on venue_availability for select
  to authenticated
  using (
    event_id is null
    or exists (
      select 1 from events
      where events.id = venue_availability.event_id
      and events.organizer_id = auth.uid()
    )
  );
-- Organizers can insert venue availability
create policy "organizers can insert venue availability"
  on venue_availability for insert
  to authenticated
  with check (
    event_id is null
    or exists (
      select 1 from events
      where events.id = venue_availability.event_id
      and events.organizer_id = auth.uid()
    )
  );
-- Organizers can update venue availability
create policy "organizers can update venue availability"
  on venue_availability for update
  to authenticated
  using (
    event_id is null
    or exists (
      select 1 from events
      where events.id = venue_availability.event_id
      and events.organizer_id = auth.uid()
    )
  )
  with check (
    event_id is null
    or exists (
      select 1 from events
      where events.id = venue_availability.event_id
      and events.organizer_id = auth.uid()
    )
  );
-- Organizers can delete venue availability
create policy "organizers can delete venue availability"
  on venue_availability for delete
  to authenticated
  using (
    event_id is null
    or exists (
      select 1 from events
      where events.id = venue_availability.event_id
      and events.organizer_id = auth.uid()
    )
  );
-- Models can view their own availability
create policy "models can view own availability"
  on model_availability for select
  to authenticated
  using (
    exists (
      select 1 from model_profiles
      where model_profiles.id = model_availability.model_profile_id
      and model_profiles.profile_id = auth.uid()
    )
  );
-- Organizers can view model availability for their events
create policy "organizers can view model availability"
  on model_availability for select
  to authenticated
  using (
    event_id is null
    or exists (
      select 1 from events
      where events.id = model_availability.event_id
      and events.organizer_id = auth.uid()
    )
  );
-- Organizers can insert model availability
create policy "organizers can insert model availability"
  on model_availability for insert
  to authenticated
  with check (
    event_id is null
    or exists (
      select 1 from events
      where events.id = model_availability.event_id
      and events.organizer_id = auth.uid()
    )
  );
-- Organizers can update model availability
create policy "organizers can update model availability"
  on model_availability for update
  to authenticated
  using (
    event_id is null
    or exists (
      select 1 from events
      where events.id = model_availability.event_id
      and events.organizer_id = auth.uid()
    )
  )
  with check (
    event_id is null
    or exists (
      select 1 from events
      where events.id = model_availability.event_id
      and events.organizer_id = auth.uid()
    )
  );
-- Organizers can delete model availability
create policy "organizers can delete model availability"
  on model_availability for delete
  to authenticated
  using (
    event_id is null
    or exists (
      select 1 from events
      where events.id = model_availability.event_id
      and events.organizer_id = auth.uid()
    )
  );
-- Organizers can view designer availability
create policy "organizers can view designer availability"
  on designer_availability for select
  to authenticated
  using (
    event_id is null
    or exists (
      select 1 from events
      where events.id = designer_availability.event_id
      and events.organizer_id = auth.uid()
    )
  );
-- Organizers can insert designer availability
create policy "organizers can insert designer availability"
  on designer_availability for insert
  to authenticated
  with check (
    event_id is null
    or exists (
      select 1 from events
      where events.id = designer_availability.event_id
      and events.organizer_id = auth.uid()
    )
  );
-- Organizers can update designer availability
create policy "organizers can update designer availability"
  on designer_availability for update
  to authenticated
  using (
    event_id is null
    or exists (
      select 1 from events
      where events.id = designer_availability.event_id
      and events.organizer_id = auth.uid()
    )
  )
  with check (
    event_id is null
    or exists (
      select 1 from events
      where events.id = designer_availability.event_id
      and events.organizer_id = auth.uid()
    )
  );
-- Organizers can delete designer availability
create policy "organizers can delete designer availability"
  on designer_availability for delete
  to authenticated
  using (
    event_id is null
    or exists (
      select 1 from events
      where events.id = designer_availability.event_id
      and events.organizer_id = auth.uid()
    )
  );
-- ============================================
-- INDEXES FOR SCHEDULING AND AVAILABILITY
-- ============================================

-- Index for event schedule lookups
create index idx_event_schedule_event on event_schedule(event_id);
-- Index for schedule time queries
create index idx_event_schedule_time on event_schedule(start_time);
-- Index for call time lookups
create index idx_call_times_event on call_times(event_id);
-- Index for call time model lookups
create index idx_call_times_model on call_times(model_profile_id) where model_profile_id is not null;
-- Index for call time stakeholder lookups
create index idx_call_times_stakeholder on call_times(stakeholder_id) where stakeholder_id is not null;
-- Index for venue availability lookups (critical for conflict detection)
create index idx_venue_availability_venue on venue_availability(venue_id);
-- Index for venue availability time range queries (using GIST for range queries)
-- Note: Requires btree_gist extension for range indexes
create extension if not exists btree_gist;
create index idx_venue_availability_time on venue_availability using gist (venue_id, tstzrange(start_time, end_time));
-- Index for model availability lookups
create index idx_model_availability_model on model_availability(model_profile_id);
-- Index for model availability time range queries
create index idx_model_availability_time on model_availability using gist (model_profile_id, tstzrange(start_time, end_time));
-- Index for designer availability lookups
create index idx_designer_availability_brand on designer_availability(brand_id);
-- Index for designer availability time range queries
create index idx_designer_availability_time on designer_availability using gist (brand_id, tstzrange(start_time, end_time));
