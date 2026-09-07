-- ============================================================================
-- Migration: Add Foreign Key for Call Times Designer ID
-- Purpose: Link call_times.designer_id to fashion_show_designer_profiles
-- Affected: public.call_times table
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
      where conname = 'call_times_designer_id_fkey'
    ) then
      -- Add foreign key constraint
      alter table public.call_times
        add constraint call_times_designer_id_fkey 
        foreign key (designer_id) 
        references public.fashion_show_designer_profiles(id) 
        on delete set null;
    end if;
  end if;
end $$;
;
