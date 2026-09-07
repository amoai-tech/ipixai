-- IPI-744 / IPI-745: token-based analysis lock for reanalyzeBrand concurrency.
-- Used by restoreBrandStatus CAS (PR #536) and stale-lock recovery (IPI-745).
alter table public.brands
  add column if not exists analysis_lock_token uuid,
  add column if not exists analysis_locked_at timestamptz;

comment on column public.brands.analysis_lock_token is
  'UUID owned by the current reanalyzeBrand run; restore/CAS only clears matching token (IPI-744).';
comment on column public.brands.analysis_locked_at is
  'When analysis_lock_token was acquired; stale recovery threshold in IPI-745.';
