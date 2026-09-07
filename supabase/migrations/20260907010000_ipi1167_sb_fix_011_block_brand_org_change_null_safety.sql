-- IPI-1167 · SB-FIX-011 — fix NULL-unsafety + wrong-id bug in
-- public.block_brand_org_change().
--
-- Confirmed live on production via read-only pg_get_functiondef
-- (2026-09-07):
--
--   if old.org_id != new.org_id and exists (select 1 from public.campaigns where brand_id = new.id) then
--     raise exception 'Cannot change brand.org_id: % campaign(s) reference this brand', ...
--
-- Two independently-verified defects:
--
-- 1. NULL-unsafety: `!=` returns NULL (not TRUE) when either operand is
--    NULL, so Postgres's `IF` treats it as false and skips the block. A
--    brand whose org_id is NULL can have its org_id set to anything —
--    or a brand's org_id can be cleared to NULL and back — without the
--    campaign-reference check ever running, even when campaigns
--    reference that brand. Fixed with `IS DISTINCT FROM`, which is
--    NULL-safe: NULL vs NULL is "not distinct" (no-op, correct), NULL vs
--    non-null is "distinct" (check runs, correct).
--
-- 2. Wrong-id reference: the campaign lookup uses `new.id` instead of
--    `old.id`. The intent is "does the row as it existed before this
--    update have campaigns referencing it" — that must be `old.id`.
--    `new.id` happens to equal `old.id` in every reachable case today
--    (brands.id is a primary key referenced by campaigns.brand_id with
--    no ON UPDATE CASCADE, so an UPDATE that changed id while
--    campaigns.brand_id still pointed at the old value would fail the FK
--    constraint before this trigger's logic could even matter) — but it
--    is still the semantically wrong reference, not just a style nit.
--
-- This CREATE OR REPLACE reproduces the recovered/local historical body
-- byte-for-byte (supabase/migrations/20260707100000_ipi268_campaigns_schema.sql)
-- — that file was never wrong; production's *live* function had drifted
-- from it independently of migration history (same class of live/ledger
-- divergence documented in IPI-1162's onboarding finding). No historical
-- migration is edited or rewritten.
--
-- security definer / search_path = 'public' are unchanged from both the
-- recovered local file and production's current live definition — only
-- the comparison logic changes.
--
-- This file only lands the fix in Git. Production apply requires a
-- separate, explicit human authorization per this repo's CLAUDE.md — see
-- the IPI-1167 deployment plan.

create or replace function public.block_brand_org_change()
returns trigger
security definer
set search_path = 'public'
as $$
begin
  if old.org_id is distinct from new.org_id then
    if exists (select 1 from public.campaigns where brand_id = old.id limit 1) then
      raise exception 'cannot change brand.org_id — campaign(s) reference this brand';
    end if;
  end if;
  return new;
end;
$$ language plpgsql;
