
-- Migration: Fix function search_path dynamically
-- Purpose: Fix search_path on functions with unknown signatures
-- Issue: Previous migration may not have matched exact function signature
-- Reference: plan/data/01-audit.md - Functions with mutable search_path
-- Date: 2026-01-21

DO $$
DECLARE
  func_oid oid;
  func_signature text;
BEGIN
  -- Find and fix check_ticket_availability
  FOR func_oid, func_signature IN 
    SELECT p.oid, p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')'
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' 
    AND p.proname = 'check_ticket_availability'
  LOOP
    EXECUTE format('ALTER FUNCTION public.%s SET search_path = public, pg_temp', func_signature);
    RAISE NOTICE 'Fixed search_path for: %', func_signature;
  END LOOP;

  -- Find and fix generate_qr_code
  FOR func_oid, func_signature IN 
    SELECT p.oid, p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')'
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' 
    AND p.proname = 'generate_qr_code'
  LOOP
    EXECUTE format('ALTER FUNCTION public.%s SET search_path = public, pg_temp', func_signature);
    RAISE NOTICE 'Fixed search_path for: %', func_signature;
  END LOOP;
END $$;
;
