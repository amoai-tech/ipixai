-- ============================================
-- Migration: Extensions and Enum Types
-- Created: 2025-01-25
-- Purpose: Enable UUID extension and create all enum types for FashionOS Events
-- Dependencies: None (foundation layer)
-- ============================================

-- Enable UUID generation extension
create extension if not exists "uuid-ossp";
-- ============================================
-- CORE EVENT ENUMS
-- ============================================

-- Event status enum
-- Tracks the lifecycle of an event from creation to completion
create type event_status as enum (
  'draft',      -- Event is being created/edited
  'review',     -- Event is under review before publishing
  'published',  -- Event is live and visible to public
  'sold_out',   -- All tickets have been sold
  'live',       -- Event is currently happening
  'cancelled',  -- Event has been cancelled
  'completed'   -- Event has finished
);
-- Ticket tier type enum
-- Defines how tickets are priced
create type ticket_tier_type as enum (
  'free',       -- No charge for tickets
  'paid',       -- Tickets require payment
  'donation'    -- Suggested donation amount
);
-- Registration status enum
-- Tracks the status of individual attendee registrations
create type registration_status as enum (
  'pending',     -- Registration created but payment not confirmed
  'confirmed',   -- Payment successful, ticket confirmed
  'checked_in',  -- Attendee has checked in at event
  'cancelled',   -- Registration was cancelled
  'refunded'     -- Payment was refunded
);
-- Payment status enum
-- Tracks payment transaction status
create type payment_status as enum (
  'pending',    -- Payment initiated but not completed
  'succeeded', -- Payment completed successfully
  'failed',     -- Payment attempt failed
  'refunded'    -- Payment was refunded
);
-- ============================================
-- ADVANCED PRODUCTION ENUMS
-- ============================================

-- Phase status enum
-- Tracks progress of event production phases (14-step timeline)
create type phase_status as enum (
  'not_started', -- Phase has not begun
  'in_progress', -- Phase is currently active
  'blocked',     -- Phase is blocked by dependencies
  'completed',   -- Phase is finished
  'at_risk'      -- Phase is at risk of delay
);
-- Task status enum
-- Tracks individual task completion within phases
create type task_status as enum (
  'todo',        -- Task not started
  'in_progress', -- Task is being worked on
  'blocked',     -- Task is blocked
  'completed',   -- Task is finished
  'cancelled'    -- Task was cancelled
);
-- Stakeholder role enum
-- Defines roles for crew members and event staff
create type stakeholder_role as enum (
  'organizer',          -- Event organizer/owner
  'photographer',      -- Event photographer
  'videographer',      -- Event videographer
  'stylist',           -- Fashion stylist
  'mua',               -- Makeup artist
  'backstage_manager', -- Backstage operations manager
  'production_assistant', -- Production support staff
  'dj',                -- DJ or music director
  'lighting_director', -- Lighting designer
  'other'              -- Other crew role
);
-- Sponsor tier enum
-- Defines sponsorship package levels
create type sponsor_tier as enum (
  'title',  -- Title sponsor (highest level)
  'gold',   -- Gold tier sponsor
  'silver', -- Silver tier sponsor
  'bronze', -- Bronze tier sponsor
  'partner' -- General partner
);
-- Fitting status enum
-- Tracks model fitting appointments
create type fitting_status as enum (
  'pending',      -- Fitting not yet scheduled
  'scheduled',   -- Fitting appointment set
  'completed',   -- Fitting finished
  'rescheduled', -- Fitting was rescheduled
  'cancelled'     -- Fitting was cancelled
);
