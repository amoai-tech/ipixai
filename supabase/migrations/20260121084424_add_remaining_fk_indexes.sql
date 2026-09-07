
-- Migration: Add remaining missing FK indexes
-- Purpose: Fix performance issues identified in audit
-- Issue: 3 foreign keys lack covering indexes (slow joins, cascade delays)
-- Reference: plan/data/01-audit.md - Performance Issues
-- Date: 2026-01-21

-- 1. designer_availability.event_id → events.id
CREATE INDEX IF NOT EXISTS idx_designer_availability_event_id 
ON public.designer_availability(event_id);

-- 2. event_sponsors.package_id → sponsorship_packages.id
CREATE INDEX IF NOT EXISTS idx_event_sponsors_package_id 
ON public.event_sponsors(package_id);

-- 3. model_availability.event_id → events.id
CREATE INDEX IF NOT EXISTS idx_model_availability_event_id 
ON public.model_availability(event_id);
;
