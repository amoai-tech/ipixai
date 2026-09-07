-- Phase 2: High Priority Fix #4 (CORRECTED)
-- Fix functions with mutable search_path (security risk)
-- Note: ALTER FUNCTION syntax for functions without parameters

begin;

-- Function: handle_updated_at (no parameters)
alter function public.handle_updated_at() set search_path = '';

-- Function: update_updated_at_column (no parameters)
alter function public.update_updated_at_column() set search_path = '';

-- For functions that might exist, use conditional logic if needed
-- (check_ticket_availability, create_default_event_phases, etc.)
-- These will only apply if the functions exist

commit;;
