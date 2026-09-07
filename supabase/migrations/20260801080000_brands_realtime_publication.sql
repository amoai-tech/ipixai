-- IPI-835 · ONB2-INT-001 Slice A — publish brands intake columns to Realtime
--
-- Brand Hub + onboarding progress listen for postgres_changes on public.brands,
-- but supabase_realtime only had brand_crawls / brand_crawl_results. Without this
-- publication, intake_status updates never reach the client.
--
-- Column list (not bare table): keep ai_profile_draft and analysis_lock_token out
-- of every Realtime payload. PK id must be included so UPDATE events keep row identity
-- (PostgreSQL 15+ column lists).
--
-- attnames ambiguity: pg_publication_tables.attnames is NULL both when the table is
-- absent (no row → NOT FOUND) and when it is published with all columns (no column
-- list). Detect absence with IF NOT FOUND; treat attnames IS NULL as wrong-shape
-- (full-table) and DROP+ADD to the safe column set. Never SET TABLE on
-- supabase_realtime (that would drop sibling tables).
--
-- Rollback:
--   alter publication supabase_realtime drop table public.brands;

do $$
declare
  current_cols name[];
  wanted       name[] := array['id', 'intake_status', 'updated_at']::name[];
begin
  select attnames
    into current_cols
  from pg_publication_tables
  where pubname = 'supabase_realtime'
    and schemaname = 'public'
    and tablename = 'brands';

  if not found then
    alter publication supabase_realtime
      add table public.brands (id, intake_status, updated_at);
    return;
  end if;

  -- Already present with the exact column set — no-op (idempotent re-apply).
  if current_cols is not null
     and current_cols @> wanted
     and wanted @> current_cols then
    return;
  end if;

  -- Wrong shape: full-table publish (attnames NULL) or a different column list.
  alter publication supabase_realtime drop table public.brands;
  alter publication supabase_realtime
    add table public.brands (id, intake_status, updated_at);
end $$;
