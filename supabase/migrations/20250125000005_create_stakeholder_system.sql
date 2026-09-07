-- ============================================
-- Migration: Create Stakeholder System Tables
-- Created: 2025-01-25
-- Purpose: Create organizer_teams, stakeholders, and event_stakeholders tables
-- Dependencies: 20250125000000_extensions_and_enums.sql, 20250125000002_create_events_core.sql
-- ============================================

-- ============================================
-- ORGANIZER TEAMS TABLE
-- ============================================

-- Organizer teams allow multiple users to collaborate on events
-- Future: Multi-user organization support
create table organizer_teams (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  description text,
  owner_id uuid references auth.users(id) on delete restrict not null,
  
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
comment on table organizer_teams is 'Multi-user teams for event organization. Allows collaboration between multiple organizers.';
-- Enable row level security
alter table organizer_teams enable row level security;
-- ============================================
-- STAKEHOLDERS TABLE (Crew Directory)
-- ============================================

-- Stakeholders table stores crew members and event staff
-- Acts as a directory of photographers, stylists, MUAs, etc.
create table stakeholders (
  id uuid default gen_random_uuid() primary key,
  profile_id uuid references auth.users(id) on delete set null, -- Link to FashionOS profile (optional)
  
  -- Contact information
  name text not null,
  email text,
  phone text,
  role stakeholder_role not null,
  specializations text[], -- e.g. ['editorial', 'runway', 'commercial']
  
  -- Portfolio and social
  portfolio_url text,
  instagram_handle text,
  
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
comment on table stakeholders is 'Crew directory for event staff. Stores photographers, stylists, MUAs, and other production team members.';
-- Enable row level security
alter table stakeholders enable row level security;
-- ============================================
-- EVENT STAKEHOLDERS TABLE (Crew Assignments)
-- ============================================

-- Event stakeholders links crew members to specific events
-- Tracks role assignments and payment rates
create table event_stakeholders (
  id uuid default gen_random_uuid() primary key,
  event_id uuid references events(id) on delete cascade not null,
  stakeholder_id uuid references stakeholders(id) on delete restrict not null,
  
  role stakeholder_role not null,
  rate decimal(10, 2), -- Payment rate if applicable
  notes text,
  
  created_at timestamptz default now(),
  
  -- One role per stakeholder per event
  unique(event_id, stakeholder_id)
);
comment on table event_stakeholders is 'Crew assignments for events. Links stakeholders (crew members) to events with specific roles and rates.';
-- Enable row level security
alter table event_stakeholders enable row level security;
-- ============================================
-- RLS POLICIES FOR ORGANIZER TEAMS
-- ============================================

-- Team owners can view their teams
create policy "team owners can view teams"
  on organizer_teams for select
  to authenticated
  using (auth.uid() = owner_id);
-- Team owners can insert teams
create policy "team owners can insert teams"
  on organizer_teams for insert
  to authenticated
  with check (auth.uid() = owner_id);
-- Team owners can update their teams
create policy "team owners can update teams"
  on organizer_teams for update
  to authenticated
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);
-- Team owners can delete their teams
create policy "team owners can delete teams"
  on organizer_teams for delete
  to authenticated
  using (auth.uid() = owner_id);
-- ============================================
-- RLS POLICIES FOR STAKEHOLDERS
-- ============================================

-- Public can view stakeholders (for directory)
create policy "anon can view stakeholders"
  on stakeholders for select
  to anon
  using (true);
-- Authenticated can view stakeholders
create policy "authenticated can view stakeholders"
  on stakeholders for select
  to authenticated
  using (true);
-- Stakeholders can view their own profile
create policy "stakeholders can view own profile"
  on stakeholders for select
  to authenticated
  using (auth.uid() = profile_id);
-- Stakeholders can insert their own profile
create policy "stakeholders can insert own profile"
  on stakeholders for insert
  to authenticated
  with check (auth.uid() = profile_id);
-- Stakeholders can update their own profile
create policy "stakeholders can update own profile"
  on stakeholders for update
  to authenticated
  using (auth.uid() = profile_id)
  with check (auth.uid() = profile_id);
-- Stakeholders can delete their own profile
create policy "stakeholders can delete own profile"
  on stakeholders for delete
  to authenticated
  using (auth.uid() = profile_id);
-- Authenticated users can insert new stakeholders
create policy "authenticated can insert stakeholders"
  on stakeholders for insert
  to authenticated
  with check (auth.uid() = profile_id or profile_id is null);
-- ============================================
-- RLS POLICIES FOR EVENT STAKEHOLDERS
-- ============================================

-- Public can view stakeholders for published events
create policy "anon can view published event stakeholders"
  on event_stakeholders for select
  to anon
  using (
    exists (
      select 1 from events
      where events.id = event_stakeholders.event_id
      and events.status = 'published'
      and events.is_public = true
    )
  );
-- Authenticated can view stakeholders for published events
create policy "authenticated can view published event stakeholders"
  on event_stakeholders for select
  to authenticated
  using (
    exists (
      select 1 from events
      where events.id = event_stakeholders.event_id
      and events.status = 'published'
      and events.is_public = true
    )
  );
-- Organizers can view stakeholders for their events
create policy "organizers can view event stakeholders"
  on event_stakeholders for select
  to authenticated
  using (
    exists (
      select 1 from events
      where events.id = event_stakeholders.event_id
      and events.organizer_id = auth.uid()
    )
  );
-- Organizers can insert stakeholders for their events
create policy "organizers can insert event stakeholders"
  on event_stakeholders for insert
  to authenticated
  with check (
    exists (
      select 1 from events
      where events.id = event_stakeholders.event_id
      and events.organizer_id = auth.uid()
    )
  );
-- Organizers can update stakeholders for their events
create policy "organizers can update event stakeholders"
  on event_stakeholders for update
  to authenticated
  using (
    exists (
      select 1 from events
      where events.id = event_stakeholders.event_id
      and events.organizer_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from events
      where events.id = event_stakeholders.event_id
      and events.organizer_id = auth.uid()
    )
  );
-- Organizers can delete stakeholders for their events
create policy "organizers can delete event stakeholders"
  on event_stakeholders for delete
  to authenticated
  using (
    exists (
      select 1 from events
      where events.id = event_stakeholders.event_id
      and events.organizer_id = auth.uid()
    )
  );
-- Stakeholders can view their own assignments
create policy "stakeholders can view own assignments"
  on event_stakeholders for select
  to authenticated
  using (
    exists (
      select 1 from stakeholders
      where stakeholders.id = event_stakeholders.stakeholder_id
      and stakeholders.profile_id = auth.uid()
    )
  );
-- ============================================
-- INDEXES FOR STAKEHOLDER SYSTEM
-- ============================================

-- Index for organizer team owner lookups
create index idx_organizer_teams_owner on organizer_teams(owner_id);
-- Index for stakeholder profile lookups
create index idx_stakeholders_profile on stakeholders(profile_id) where profile_id is not null;
-- Index for stakeholder role filtering
create index idx_stakeholders_role on stakeholders(role);
-- Index for event stakeholder lookups
create index idx_event_stakeholders_event on event_stakeholders(event_id);
-- Index for stakeholder assignment lookups
create index idx_event_stakeholders_stakeholder on event_stakeholders(stakeholder_id);
