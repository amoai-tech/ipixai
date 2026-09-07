-- ============================================
-- Migration: Create Database Triggers and Functions
-- Created: 2025-01-25
-- Purpose: Create utility functions and triggers for automation
-- Dependencies: All previous table migrations
-- ============================================

-- ============================================
-- UTILITY FUNCTIONS
-- ============================================

-- Function to auto-update updated_at timestamp
-- Used by triggers on tables with updated_at columns
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;
comment on function update_updated_at_column() is 'Trigger function to automatically update the updated_at timestamp when a row is modified.';
-- ============================================
-- TICKET AVAILABILITY CHECK FUNCTION
-- ============================================

-- Function to check ticket availability before registration
-- Validates that tickets are available and increments quantity_sold
create or replace function check_ticket_availability()
returns trigger as $$
declare
  tier_record ticket_tiers%rowtype;
begin
  -- Get ticket tier information
  select * into tier_record
  from ticket_tiers
  where id = new.ticket_tier_id;
  
  -- Check if tickets are available
  if tier_record.quantity_sold >= tier_record.quantity_total then
    raise exception 'Ticket tier "%" is sold out', tier_record.name;
  end if;
  
  -- Increment quantity_sold if registration is confirmed
  if new.status = 'confirmed' then
    update ticket_tiers
    set quantity_sold = quantity_sold + 1
    where id = new.ticket_tier_id;
  end if;
  
  return new;
end;
$$ language plpgsql;
comment on function check_ticket_availability() is 'Trigger function to validate ticket availability before registration and increment quantity_sold when registration is confirmed.';
-- ============================================
-- QR CODE GENERATION FUNCTION
-- ============================================

-- Function to auto-generate unique QR code data for registrations
-- Generates a unique hex string for QR code generation
create or replace function generate_qr_code()
returns trigger as $$
begin
  -- Generate unique QR code if not already set
  if new.qr_code_data is null then
    new.qr_code_data := encode(gen_random_bytes(16), 'hex');
  end if;
  return new;
end;
$$ language plpgsql;
comment on function generate_qr_code() is 'Trigger function to automatically generate a unique QR code string for registrations. Used for check-in at events.';
-- ============================================
-- AUTO-CREATE EVENT PHASES FUNCTION
-- ============================================

-- Function to create default 14 phases when event is created
-- Automatically populates the production timeline
create or replace function create_default_event_phases()
returns trigger as $$
declare
  phase_names text[] := array[
    'Concept & Vision',
    'Budget & Funding',
    'Collection Development',
    'Casting & Fittings',
    'Venue Selection',
    'Production Design',
    'Sponsor Acquisition',
    'Marketing & PR',
    'Technical Setup',
    'Rehearsals',
    'Final Preparations',
    'Showtime Execution',
    'Post-Event Content',
    'ROI & Review'
  ];
  phase_keys text[] := array[
    'concept',
    'budget',
    'collection',
    'casting',
    'venue',
    'production_design',
    'sponsors',
    'marketing',
    'technical',
    'rehearsals',
    'final_prep',
    'showtime',
    'post_content',
    'roi'
  ];
  i integer;
begin
  -- Create 14 default phases for the new event
  for i in 1..14 loop
    insert into event_phases (event_id, phase_name, phase_key, order_index)
    values (new.id, phase_names[i], phase_keys[i], i - 1);
  end loop;
  
  return new;
end;
$$ language plpgsql;
comment on function create_default_event_phases() is 'Trigger function to automatically create 14 default production phases when an event is created. Populates the complete production timeline.';
-- ============================================
-- TRIGGERS
-- ============================================

-- Auto-update updated_at triggers
create trigger update_events_updated_at
  before update on events
  for each row
  execute function update_updated_at_column();
create trigger update_venues_updated_at
  before update on venues
  for each row
  execute function update_updated_at_column();
create trigger update_registrations_updated_at
  before update on registrations
  for each row
  execute function update_updated_at_column();
create trigger update_organizer_teams_updated_at
  before update on organizer_teams
  for each row
  execute function update_updated_at_column();
create trigger update_stakeholders_updated_at
  before update on stakeholders
  for each row
  execute function update_updated_at_column();
create trigger update_model_profiles_updated_at
  before update on model_profiles
  for each row
  execute function update_updated_at_column();
create trigger update_event_models_updated_at
  before update on event_models
  for each row
  execute function update_updated_at_column();
create trigger update_event_phases_updated_at
  before update on event_phases
  for each row
  execute function update_updated_at_column();
create trigger update_tasks_updated_at
  before update on tasks
  for each row
  execute function update_updated_at_column();
create trigger update_fashion_brands_updated_at
  before update on fashion_brands
  for each row
  execute function update_updated_at_column();
create trigger update_sponsor_organizations_updated_at
  before update on sponsor_organizations
  for each row
  execute function update_updated_at_column();
create trigger update_event_sponsors_updated_at
  before update on event_sponsors
  for each row
  execute function update_updated_at_column();
-- Ticket availability check trigger
create trigger check_availability_before_registration
  before insert on registrations
  for each row
  execute function check_ticket_availability();
-- QR code generation trigger
create trigger generate_qr_on_registration
  before insert on registrations
  for each row
  execute function generate_qr_code();
-- Auto-create phases trigger
create trigger create_phases_on_event_creation
  after insert on events
  for each row
  execute function create_default_event_phases();
