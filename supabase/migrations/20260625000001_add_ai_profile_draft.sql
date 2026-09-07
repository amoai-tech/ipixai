-- IPI-123 DASH-003 AC5: draft column + enum value for HITL re-analyze workflow
-- Stores pending AI profile until operator confirms; NULL = no pending draft
-- IPI-614: DO block added so this migration is self-contained during db reset
-- (brand_intake_status is NOT yet created at this migration's position in the
-- sort order — 20260626000000 creates it later, but runs alphabetically after).
-- On remote the DO block is a no-op since the type already exists.
do $$
begin
  if to_regtype('public.brand_intake_status') is null then
    create type public.brand_intake_status as enum (
      'brand_created', 'crawl_running', 'crawl_complete',
      'analysis_running', 'scores_complete', 'ready', 'failed',
      'draft_ready'
    );
  end if;
end $$;

ALTER TYPE public.brand_intake_status ADD VALUE IF NOT EXISTS 'draft_ready';
ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS ai_profile_draft JSONB;
