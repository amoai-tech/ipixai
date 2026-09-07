-- ============================================
-- Migration: Create Ticket System Tables
-- Created: 2025-01-25
-- Purpose: Create ticket_tiers, registrations, and payments tables
-- Dependencies: 20250125000002_create_events_core.sql
-- ============================================

-- ============================================
-- TICKET TIERS TABLE
-- ============================================

-- Ticket tiers define pricing and availability for event tickets
-- Examples: "VIP", "Early Bird", "General Admission"
create table ticket_tiers (
  id uuid default gen_random_uuid() primary key,
  event_id uuid references events(id) on delete cascade not null,
  
  -- Tier information
  name text not null, -- e.g. "VIP", "Early Bird", "General Admission"
  description text,
  type ticket_tier_type default 'paid',
  
  -- Pricing
  price decimal(10, 2) default 0.00,
  currency text default 'USD',
  
  -- Availability management
  quantity_total integer not null,
  quantity_sold integer default 0,
  sales_start_at timestamptz,
  sales_end_at timestamptz,
  
  created_at timestamptz default now()
);
comment on table ticket_tiers is 'Ticket pricing and availability configuration. Defines different ticket types (VIP, GA, etc.) with pricing and quantity limits.';
-- Enable row level security
alter table ticket_tiers enable row level security;
-- ============================================
-- REGISTRATIONS TABLE (Tickets)
-- ============================================

-- Registrations are individual ticket purchases/RSVPs
-- Links attendees to specific ticket tiers
create table registrations (
  id uuid default gen_random_uuid() primary key,
  event_id uuid references events(id) on delete cascade not null,
  ticket_tier_id uuid references ticket_tiers(id) on delete restrict not null,
  profile_id uuid references auth.users(id) on delete set null, -- Link to FashionOS profile (optional for guest checkout)
  
  -- Snapshot data (for guest checkout - preserves data even if profile changes)
  attendee_email text not null,
  attendee_name text not null,
  
  -- Status and access control
  status registration_status default 'pending',
  qr_code_data text unique, -- Unique string for QR code generation (for check-in)
  checked_in_at timestamptz,
  
  -- Metadata
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
comment on table registrations is 'Individual attendee registrations/tickets. Links users to ticket tiers and tracks check-in status.';
-- Enable row level security
alter table registrations enable row level security;
-- ============================================
-- PAYMENTS TABLE
-- ============================================

-- Payments table stores financial transaction records
-- Links to registrations for audit trail
create table payments (
  id uuid default gen_random_uuid() primary key,
  registration_id uuid references registrations(id) on delete cascade not null,
  payer_id uuid references auth.users(id) on delete set null,
  
  -- Amount and currency
  amount decimal(10, 2) not null,
  currency text default 'USD',
  status payment_status default 'pending',
  
  -- Payment provider information
  provider text default 'stripe',
  provider_payment_id text, -- Stripe PaymentIntent ID or other provider transaction ID
  
  created_at timestamptz default now()
);
comment on table payments is 'Financial transaction records for ticket purchases. Links to registrations and payment providers (Stripe).';
-- Enable row level security
alter table payments enable row level security;
-- ============================================
-- RLS POLICIES FOR TICKET TIERS
-- ============================================

-- Public can view ticket tiers for published events (for purchase flow)
create policy "anon can view published ticket tiers"
  on ticket_tiers for select
  to anon
  using (
    exists (
      select 1 from events
      where events.id = ticket_tiers.event_id
      and events.status = 'published'
      and events.is_public = true
    )
  );
-- Authenticated can view ticket tiers for published events
create policy "authenticated can view published ticket tiers"
  on ticket_tiers for select
  to authenticated
  using (
    exists (
      select 1 from events
      where events.id = ticket_tiers.event_id
      and events.status = 'published'
      and events.is_public = true
    )
  );
-- Organizers can view ticket tiers for their events
create policy "organizers can view ticket tiers"
  on ticket_tiers for select
  to authenticated
  using (
    exists (
      select 1 from events
      where events.id = ticket_tiers.event_id
      and events.organizer_id = auth.uid()
    )
  );
-- Organizers can insert ticket tiers for their events
create policy "organizers can insert ticket tiers"
  on ticket_tiers for insert
  to authenticated
  with check (
    exists (
      select 1 from events
      where events.id = ticket_tiers.event_id
      and events.organizer_id = auth.uid()
    )
  );
-- Organizers can update ticket tiers for their events
create policy "organizers can update ticket tiers"
  on ticket_tiers for update
  to authenticated
  using (
    exists (
      select 1 from events
      where events.id = ticket_tiers.event_id
      and events.organizer_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from events
      where events.id = ticket_tiers.event_id
      and events.organizer_id = auth.uid()
    )
  );
-- Organizers can delete ticket tiers for their events
create policy "organizers can delete ticket tiers"
  on ticket_tiers for delete
  to authenticated
  using (
    exists (
      select 1 from events
      where events.id = ticket_tiers.event_id
      and events.organizer_id = auth.uid()
    )
  );
-- ============================================
-- RLS POLICIES FOR REGISTRATIONS
-- ============================================

-- Users can view their own registrations
create policy "users can view own registrations"
  on registrations for select
  to authenticated
  using (auth.uid() = profile_id);
-- Public can create registrations (for guest checkout)
create policy "anon can create registrations"
  on registrations for insert
  to anon
  with check (
    exists (
      select 1 from events
      where events.id = registrations.event_id
      and events.status = 'published'
    )
  );
-- Authenticated users can create registrations
create policy "authenticated can create registrations"
  on registrations for insert
  to authenticated
  with check (
    exists (
      select 1 from events
      where events.id = registrations.event_id
      and events.status = 'published'
    )
  );
-- Organizers can view all registrations for their events
create policy "organizers can view event registrations"
  on registrations for select
  to authenticated
  using (
    exists (
      select 1 from events
      where events.id = registrations.event_id
      and events.organizer_id = auth.uid()
    )
  );
-- Users can update their own registrations (for check-in, etc.)
create policy "users can update own registrations"
  on registrations for update
  to authenticated
  using (auth.uid() = profile_id)
  with check (auth.uid() = profile_id);
-- ============================================
-- RLS POLICIES FOR PAYMENTS
-- ============================================

-- Users can view their own payments
create policy "users can view own payments"
  on payments for select
  to authenticated
  using (auth.uid() = payer_id);
-- Organizers can view payments for their events
create policy "organizers can view event payments"
  on payments for select
  to authenticated
  using (
    exists (
      select 1 from registrations
      inner join events on events.id = registrations.event_id
      where registrations.id = payments.registration_id
      and events.organizer_id = auth.uid()
    )
  );
-- Public can create payments (for guest checkout)
create policy "anon can create payments"
  on payments for insert
  to anon
  with check (
    exists (
      select 1 from registrations
      inner join events on events.id = registrations.event_id
      where registrations.id = payments.registration_id
      and events.status = 'published'
    )
  );
-- Authenticated users can create payments
create policy "authenticated can create payments"
  on payments for insert
  to authenticated
  with check (
    exists (
      select 1 from registrations
      inner join events on events.id = registrations.event_id
      where registrations.id = payments.registration_id
      and events.status = 'published'
    )
  );
-- ============================================
-- INDEXES FOR TICKET SYSTEM
-- ============================================

-- Index for event ticket tier lookups
create index idx_ticket_tiers_event on ticket_tiers(event_id);
-- Index for registration event lookups
create index idx_registrations_event on registrations(event_id);
-- Index for registration email lookups (guest checkout)
create index idx_registrations_email on registrations(attendee_email);
-- Index for QR code lookups (check-in)
create unique index idx_registrations_qr on registrations(qr_code_data) where qr_code_data is not null;
-- Index for user profile lookups
create index idx_registrations_profile on registrations(profile_id) where profile_id is not null;
-- Index for payment registration lookups
create index idx_payments_registration on payments(registration_id);
-- Index for payment payer lookups
create index idx_payments_payer on payments(payer_id) where payer_id is not null;
