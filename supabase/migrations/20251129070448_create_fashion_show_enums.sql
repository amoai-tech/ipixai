-- ============================================================================
-- Migration: Create Fashion Show Planner Enums
-- Purpose: Define custom types for fashion show planning system
-- Affected: Multiple enum types
-- Dependencies: None
-- ============================================================================

-- Enable UUID extension if not already enabled
create extension if not exists "uuid-ossp";

-- 1. Stakeholder & Roles Enum
-- Note: Different from existing stakeholder_role enum (which is for shoot booking)
-- This is for fashion show planner roles
do $$
begin
  if not exists (select 1 from pg_type where typname = 'stakeholder_role_enum') then
    create type stakeholder_role_enum as enum (
      'designer', 
      'producer', 
      'model', 
      'model_agency', 
      'hmu_lead', 
      'stylist', 
      'backstage_crew', 
      'venue_manager', 
      'lighting_sound', 
      'sponsor', 
      'pr_agent', 
      'photographer', 
      'videographer',
      'volunteer', 
      'security', 
      'guest', 
      'other'
    );
    comment on type stakeholder_role_enum is 'Stakeholder roles specific to fashion show planning';
  end if;
end $$;

-- 2. Logistics Types
do $$
begin
  if not exists (select 1 from pg_type where typname = 'venue_type') then
    create type venue_type as enum (
      'runway', 
      'gallery', 
      'hotel', 
      'warehouse', 
      'rooftop', 
      'outdoor', 
      'studio', 
      'other'
    );
    comment on type venue_type is 'Types of venues for fashion events';
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'indoor_outdoor') then
    create type indoor_outdoor as enum (
      'indoor', 
      'outdoor', 
      'mixed'
    );
    comment on type indoor_outdoor is 'Venue location type';
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'availability_status') then
    create type availability_status as enum (
      'available', 
      'reserved', 
      'booked', 
      'conflict', 
      'travel', 
      'maintenance', 
      'not_available'
    );
    comment on type availability_status is 'Status for venue, model, and designer availability';
  end if;
end $$;

-- 3. Commercial Types
do $$
begin
  if not exists (select 1 from pg_type where typname = 'sponsor_level') then
    create type sponsor_level as enum (
      'title', 
      'gold', 
      'silver', 
      'partner', 
      'in_kind'
    );
    comment on type sponsor_level is 'Sponsor tier levels';
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'brand_type') then
    create type brand_type as enum (
      'couture', 
      'streetwear', 
      'bridal', 
      'swim', 
      'rtw', 
      'avant_garde', 
      'menswear'
    );
    comment on type brand_type is 'Fashion brand categories';
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'organizer_type') then
    create type organizer_type as enum (
      'agency', 
      'production_house', 
      'freelance_collective', 
      'internal'
    );
    comment on type organizer_type is 'Type of event organizing organization';
  end if;
end $$;

-- 4. Scheduling Types
do $$
begin
  if not exists (select 1 from pg_type where typname = 'schedule_type') then
    create type schedule_type as enum (
      'rehearsal', 
      'fitting', 
      'hair_makeup', 
      'call_time', 
      'runway_show', 
      'sponsor_activation', 
      'vip_reception', 
      'teardown', 
      'photo_call'
    );
    comment on type schedule_type is 'Types of schedule items in event timeline';
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'rehearsal_type') then
    create type rehearsal_type as enum (
      'full_run', 
      'lighting_test', 
      'sound_check', 
      'walk_practice', 
      'tech_run'
    );
    comment on type rehearsal_type is 'Types of rehearsal sessions';
  end if;
end $$;

-- 5. Task Priority (if not exists)
do $$
begin
  if not exists (select 1 from pg_type where typname = 'task_priority') then
    create type task_priority as enum (
      'low', 
      'medium', 
      'high', 
      'critical'
    );
    comment on type task_priority is 'Task priority levels';
  end if;
end $$;
;
