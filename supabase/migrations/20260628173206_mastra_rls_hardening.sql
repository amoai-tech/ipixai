-- IPI-227 — Harden public.mastra_* tables against PostgREST exposure.
-- Mastra runtime (@mastra/pg PostgresStore) creates these tables; no CREATE in repo.
-- This migration hardens whatever mastra_* tables exist at apply time (skips absent).
-- No anon/auth policies: RLS default-deny + revoked grants. Pooler postgres bypasses RLS.

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename LIKE 'mastra\_%'
    ORDER BY tablename
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.tablename);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon', r.tablename);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM authenticated', r.tablename);
  END LOOP;
END $$;
