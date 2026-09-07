-- Phase 2: High Priority Fix #5
-- Remove duplicate index on event_designers table

begin;

-- Drop the duplicate index (idx_event_designers_designer_id_fk)
drop index if exists public.idx_event_designers_designer_id_fk;

-- Verify primary index exists (create if missing)
create index if not exists idx_event_designers_designer_id
on public.event_designers(designer_id)
where designer_id is not null;

commit;;
