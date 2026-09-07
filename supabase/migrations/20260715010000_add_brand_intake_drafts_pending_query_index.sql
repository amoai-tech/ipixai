-- IPI-615 — replace brand_intake_drafts_pending_user_updated_idx with correct column order
-- The index was originally created with (user_id, status, updated_at DESC) in
-- 20260626000005, which cannot serve a single globally-sorted ORDER BY updated_at DESC
-- when both status values are requested. The correct order is (user_id, updated_at DESC, status).
--
-- DROP + CREATE (rather than IF NOT EXISTS) ensures every environment gets the correct
-- order regardless of whether the historical migration created the index with the old order.
--
-- CREATE INDEX CONCURRENTLY is not used because Supabase migration files run inside a
-- transaction, which is incompatible with CONCURRENTLY. The brand_intake_drafts table is
-- small (<10K rows per tenant), so the brief ACCESS EXCLUSIVE lock is negligible.

DROP INDEX IF EXISTS public.brand_intake_drafts_pending_user_updated_idx;

CREATE INDEX brand_intake_drafts_pending_user_updated_idx
ON public.brand_intake_drafts (
  user_id,
  updated_at DESC,
  status
)
WHERE status IN ('pending', 'pending_approval');
