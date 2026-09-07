-- ============================================
-- Migration: Create Casting System Tables
-- Created: 2025-01-25
-- Purpose: Create model_agencies, model_profiles, and event_models tables
-- Dependencies: 20250125000000_extensions_and_enums.sql, 20250125000002_create_events_core.sql
-- ============================================

-- ============================================
-- MODEL AGENCIES TABLE
-- ============================================

-- Model agencies stores agency contact information
-- Links to model profiles for agency representation
create table model_agencies (
  id uuid default gen_random_uuid() primary key,
  
  name text not null,
  contact_email text,
  contact_phone text,
  website_url text,
  
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
comment on table model_agencies is 'Model agency records. Stores contact information for agencies representing models.';
-- Enable row level security
alter table model_agencies enable row level security;
-- ============================================
-- MODEL PROFILES TABLE
-- ============================================

-- Model profiles stores detailed model information
-- Includes measurements, portfolio, and availability
create table model_profiles (
  id uuid default gen_random_uuid() primary key,
  profile_id uuid references auth.users(id) on delete set null, -- Link to FashionOS profile
  agency_id uuid references model_agencies(id) on delete set null,
  
  -- Basic information
  name text not null,
  email text,
  phone text,
  
  -- Measurements (for casting)
  height_cm integer,
  bust_cm integer,
  waist_cm integer,
  hips_cm integer,
  shoe_size text,
  hair_color text,
  eye_color text,
  
  -- Portfolio and social
  portfolio_url text,
  instagram_handle text,
  
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
comment on table model_profiles is 'Detailed model profiles with measurements, portfolio, and contact information. Used for event casting.';
-- Enable row level security
alter table model_profiles enable row level security;
-- ============================================
-- EVENT MODELS TABLE (Casting)
-- ============================================

-- Event models links models to specific events
-- Tracks look count, fitting status, and rates
create table event_models (
  id uuid default gen_random_uuid() primary key,
  event_id uuid references events(id) on delete cascade not null,
  model_profile_id uuid references model_profiles(id) on delete restrict not null,
  
  -- Casting details
  look_count integer default 1, -- Number of looks/models assigned
  fitting_status fitting_status default 'pending',
  fitting_date timestamptz,
  
  -- Payment and notes
  rate decimal(10, 2), -- Payment rate
  notes text,
  
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  
  -- One casting per model per event
  unique(event_id, model_profile_id)
);
comment on table event_models is 'Model casting for events. Links models to events with fitting status, look count, and payment rates.';
-- Enable row level security
alter table event_models enable row level security;
-- ============================================
-- RLS POLICIES FOR MODEL AGENCIES
-- ============================================

-- Public can view model agencies (for directory)
create policy "anon can view model agencies"
  on model_agencies for select
  to anon
  using (true);
-- Authenticated can view model agencies
create policy "authenticated can view model agencies"
  on model_agencies for select
  to authenticated
  using (true);
-- Authenticated users can insert agencies
create policy "authenticated can insert model agencies"
  on model_agencies for insert
  to authenticated
  with check (true);
-- Authenticated users can update agencies
create policy "authenticated can update model agencies"
  on model_agencies for update
  to authenticated
  using (true)
  with check (true);
-- Authenticated users can delete agencies
create policy "authenticated can delete model agencies"
  on model_agencies for delete
  to authenticated
  using (true);
-- ============================================
-- RLS POLICIES FOR MODEL PROFILES
-- ============================================

-- Public can view model profiles (for casting directory)
create policy "anon can view model profiles"
  on model_profiles for select
  to anon
  using (true);
-- Authenticated can view model profiles
create policy "authenticated can view model profiles"
  on model_profiles for select
  to authenticated
  using (true);
-- Models can view their own profile
create policy "models can view own profile"
  on model_profiles for select
  to authenticated
  using (auth.uid() = profile_id);
-- Models can insert their own profile
create policy "models can insert own profile"
  on model_profiles for insert
  to authenticated
  with check (auth.uid() = profile_id);
-- Models can update their own profile
create policy "models can update own profile"
  on model_profiles for update
  to authenticated
  using (auth.uid() = profile_id)
  with check (auth.uid() = profile_id);
-- Models can delete their own profile
create policy "models can delete own profile"
  on model_profiles for delete
  to authenticated
  using (auth.uid() = profile_id);
-- Authenticated users can insert new model profiles
create policy "authenticated can insert model profiles"
  on model_profiles for insert
  to authenticated
  with check (auth.uid() = profile_id or profile_id is null);
-- ============================================
-- RLS POLICIES FOR EVENT MODELS
-- ============================================

-- Public can view models for published events
create policy "anon can view published event models"
  on event_models for select
  to anon
  using (
    exists (
      select 1 from events
      where events.id = event_models.event_id
      and events.status = 'published'
      and events.is_public = true
    )
  );
-- Authenticated can view models for published events
create policy "authenticated can view published event models"
  on event_models for select
  to authenticated
  using (
    exists (
      select 1 from events
      where events.id = event_models.event_id
      and events.status = 'published'
      and events.is_public = true
    )
  );
-- Organizers can view models for their events
create policy "organizers can view event models"
  on event_models for select
  to authenticated
  using (
    exists (
      select 1 from events
      where events.id = event_models.event_id
      and events.organizer_id = auth.uid()
    )
  );
-- Organizers can insert models for their events
create policy "organizers can insert event models"
  on event_models for insert
  to authenticated
  with check (
    exists (
      select 1 from events
      where events.id = event_models.event_id
      and events.organizer_id = auth.uid()
    )
  );
-- Organizers can update models for their events
create policy "organizers can update event models"
  on event_models for update
  to authenticated
  using (
    exists (
      select 1 from events
      where events.id = event_models.event_id
      and events.organizer_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from events
      where events.id = event_models.event_id
      and events.organizer_id = auth.uid()
    )
  );
-- Organizers can delete models for their events
create policy "organizers can delete event models"
  on event_models for delete
  to authenticated
  using (
    exists (
      select 1 from events
      where events.id = event_models.event_id
      and events.organizer_id = auth.uid()
    )
  );
-- Models can view their own casting assignments
create policy "models can view own casting"
  on event_models for select
  to authenticated
  using (
    exists (
      select 1 from model_profiles
      where model_profiles.id = event_models.model_profile_id
      and model_profiles.profile_id = auth.uid()
    )
  );
-- ============================================
-- INDEXES FOR CASTING SYSTEM
-- ============================================

-- Index for model profile lookups
create index idx_model_profiles_profile on model_profiles(profile_id) where profile_id is not null;
-- Index for agency lookups
create index idx_model_profiles_agency on model_profiles(agency_id) where agency_id is not null;
-- Index for event model lookups
create index idx_event_models_event on event_models(event_id);
-- Index for model casting lookups
create index idx_event_models_profile on event_models(model_profile_id);
-- Index for fitting status filtering
create index idx_event_models_fitting_status on event_models(fitting_status);
