-- ============================================
-- Migration: Create Sponsorship System Tables
-- Created: 2025-01-25
-- Purpose: Create sponsor_organizations, sponsorship_packages, and event_sponsors tables
-- Dependencies: 20250125000000_extensions_and_enums.sql, 20250125000002_create_events_core.sql
-- ============================================

-- ============================================
-- SPONSOR ORGANIZATIONS TABLE
-- ============================================

-- Sponsor organizations stores brand/company records
-- Reusable database of potential sponsors
create table sponsor_organizations (
  id uuid default gen_random_uuid() primary key,
  
  -- Organization information
  name text not null,
  description text,
  website_url text,
  logo_url text,
  industry text, -- e.g. "Luxury Fashion", "Beauty", "Tech"
  
  -- Contact information
  contact_email text,
  contact_name text,
  contact_phone text,
  
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
comment on table sponsor_organizations is 'Brand and company records for potential event sponsors. Reusable database of sponsor organizations.';
-- Enable row level security
alter table sponsor_organizations enable row level security;
-- ============================================
-- SPONSORSHIP PACKAGES TABLE (Templates)
-- ============================================

-- Sponsorship packages define standard package templates
-- Examples: "Gold Package", "Silver Package" with predefined deliverables
create table sponsorship_packages (
  id uuid default gen_random_uuid() primary key,
  
  name text not null, -- e.g. "Gold Package"
  tier sponsor_tier not null,
  
  -- Package pricing and deliverables
  price decimal(10, 2), -- Base package price
  deliverables jsonb, -- JSON array of deliverables
  
  created_at timestamptz default now()
);
comment on table sponsorship_packages is 'Standard sponsorship package templates. Defines tiers (Gold/Silver/Bronze) with base pricing and deliverables.';
-- Enable row level security
alter table sponsorship_packages enable row level security;
-- ============================================
-- EVENT SPONSORS TABLE
-- ============================================

-- Event sponsors links sponsor organizations to specific events
-- Tracks tier, amount, deliverables, and contract status
create table event_sponsors (
  id uuid default gen_random_uuid() primary key,
  event_id uuid references events(id) on delete cascade not null,
  sponsor_org_id uuid references sponsor_organizations(id) on delete restrict not null,
  package_id uuid references sponsorship_packages(id) on delete set null,
  
  -- Sponsorship details
  tier sponsor_tier not null,
  amount decimal(10, 2), -- Actual sponsorship amount
  deliverables jsonb, -- Custom deliverables JSON
  contract_url text, -- Link to contract PDF in storage
  
  -- Status tracking
  status text default 'pending', -- 'pending', 'confirmed', 'fulfilled'
  
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
comment on table event_sponsors is 'Sponsor assignments for events. Links sponsor organizations to events with specific tiers, amounts, and deliverables.';
-- Enable row level security
alter table event_sponsors enable row level security;
-- ============================================
-- RLS POLICIES FOR SPONSOR ORGANIZATIONS
-- ============================================

-- Public can view sponsor organizations (for directory)
create policy "anon can view sponsor organizations"
  on sponsor_organizations for select
  to anon
  using (true);
-- Authenticated can view sponsor organizations
create policy "authenticated can view sponsor organizations"
  on sponsor_organizations for select
  to authenticated
  using (true);
-- Authenticated users can insert sponsor organizations
create policy "authenticated can insert sponsor organizations"
  on sponsor_organizations for insert
  to authenticated
  with check (true);
-- Authenticated users can update sponsor organizations
create policy "authenticated can update sponsor organizations"
  on sponsor_organizations for update
  to authenticated
  using (true)
  with check (true);
-- ============================================
-- RLS POLICIES FOR SPONSORSHIP PACKAGES
-- ============================================

-- Drop existing policies if they exist (for idempotency)
drop policy if exists "anon can view sponsorship packages" on sponsorship_packages;
drop policy if exists "authenticated can view sponsorship packages" on sponsorship_packages;
drop policy if exists "authenticated can insert sponsorship packages" on sponsorship_packages;
drop policy if exists "authenticated can update sponsorship packages" on sponsorship_packages;
drop policy if exists "authenticated can delete sponsorship packages" on sponsorship_packages;
-- Public can view sponsorship packages
create policy "anon can view sponsorship packages"
  on sponsorship_packages for select
  to anon
  using (true);
-- Authenticated can view sponsorship packages
create policy "authenticated can view sponsorship packages"
  on sponsorship_packages for select
  to authenticated
  using (true);
-- Authenticated users can insert packages
create policy "authenticated can insert sponsorship packages"
  on sponsorship_packages for insert
  to authenticated
  with check (true);
-- Authenticated users can update packages
create policy "authenticated can update sponsorship packages"
  on sponsorship_packages for update
  to authenticated
  using (true)
  with check (true);
-- Authenticated users can delete packages
create policy "authenticated can delete sponsorship packages"
  on sponsorship_packages for delete
  to authenticated
  using (true);
-- ============================================
-- RLS POLICIES FOR EVENT SPONSORS
-- ============================================

-- Public can view sponsors for published events
create policy "anon can view published event sponsors"
  on event_sponsors for select
  to anon
  using (
    exists (
      select 1 from events
      where events.id = event_sponsors.event_id
      and events.status = 'published'
      and events.is_public = true
    )
  );
-- Authenticated can view sponsors for published events
create policy "authenticated can view published event sponsors"
  on event_sponsors for select
  to authenticated
  using (
    exists (
      select 1 from events
      where events.id = event_sponsors.event_id
      and events.status = 'published'
      and events.is_public = true
    )
  );
-- Organizers can view sponsors for their events
create policy "organizers can view event sponsors"
  on event_sponsors for select
  to authenticated
  using (
    exists (
      select 1 from events
      where events.id = event_sponsors.event_id
      and events.organizer_id = auth.uid()
    )
  );
-- Organizers can insert sponsors for their events
create policy "organizers can insert event sponsors"
  on event_sponsors for insert
  to authenticated
  with check (
    exists (
      select 1 from events
      where events.id = event_sponsors.event_id
      and events.organizer_id = auth.uid()
    )
  );
-- Organizers can update sponsors for their events
create policy "organizers can update event sponsors"
  on event_sponsors for update
  to authenticated
  using (
    exists (
      select 1 from events
      where events.id = event_sponsors.event_id
      and events.organizer_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from events
      where events.id = event_sponsors.event_id
      and events.organizer_id = auth.uid()
    )
  );
-- Organizers can delete sponsors for their events
create policy "organizers can delete event sponsors"
  on event_sponsors for delete
  to authenticated
  using (
    exists (
      select 1 from events
      where events.id = event_sponsors.event_id
      and events.organizer_id = auth.uid()
    )
  );
-- ============================================
-- INDEXES FOR SPONSOR SYSTEM
-- ============================================

-- Index for sponsor organization industry filtering
create index idx_sponsor_orgs_industry on sponsor_organizations(industry);
-- Index for sponsorship package tier lookups
create index idx_sponsorship_packages_tier on sponsorship_packages(tier);
-- Index for event sponsor lookups
create index idx_event_sponsors_event on event_sponsors(event_id);
-- Index for sponsor organization lookups
create index idx_event_sponsors_org on event_sponsors(sponsor_org_id);
-- Index for tier filtering
create index idx_event_sponsors_tier on event_sponsors(tier);
