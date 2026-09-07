-- ============================================================================
-- Migration: Add Foreign Key for Event Designers Designer ID
-- Purpose: Link event_designers.designer_id to fashion_show_designer_profiles
-- Affected: public.event_designers table
-- Dependencies: public.fashion_show_designer_profiles (must exist first)
-- ============================================================================

-- Add foreign key constraint for designer_id
-- Only add if fashion_show_designer_profiles table exists
do $$
begin
  if exists (
    select 1 from information_schema.tables 
    where table_schema = 'public' 
    and table_name = 'fashion_show_designer_profiles'
  ) then
    -- Check if constraint already exists
    if not exists (
      select 1 from pg_constraint 
      where conname = 'event_designers_designer_id_fkey'
    ) then
      -- Add foreign key constraint
      alter table public.event_designers
        add constraint event_designers_designer_id_fkey 
        foreign key (designer_id) 
        references public.fashion_show_designer_profiles(id) 
        on delete set null;
    end if;
    
    -- Add index
    create index if not exists idx_event_designers_designer_id_fk 
      on public.event_designers(designer_id) 
      where designer_id is not null;
  end if;
end $$;
;
