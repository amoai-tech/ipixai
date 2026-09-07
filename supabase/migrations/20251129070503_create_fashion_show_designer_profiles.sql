-- ============================================================================
-- Migration: Create Fashion Show Designer Profiles Table
-- Purpose: Designer profiles for fashion show planning (separate from shoot booking designer_profiles)
-- Affected: public.fashion_show_designer_profiles table
-- Dependencies: public.fashion_brands, auth.users
-- Note: This is different from designer_profiles (shoot booking) - this is for event planning
-- ============================================================================

-- Designer profiles for fashion show planning
-- Links designers to brands and allows optional user account linking
create table if not exists public.fashion_show_designer_profiles (
  id uuid default uuid_generate_v4() primary key,
  brand_id uuid references public.fashion_brands(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null, -- Optional link to user account
  
  -- Designer information
  full_name text not null,
  role text default 'head_designer',
  bio text,
  
  -- Timestamps
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

comment on table public.fashion_show_designer_profiles is 'Designer profiles for fashion show planning. Links designers to brands and events.';

-- Enable RLS
alter table public.fashion_show_designer_profiles enable row level security;

-- Indexes
create index if not exists idx_fashion_show_designer_profiles_brand_id 
  on public.fashion_show_designer_profiles(brand_id) 
  where brand_id is not null;

create index if not exists idx_fashion_show_designer_profiles_user_id 
  on public.fashion_show_designer_profiles(user_id) 
  where user_id is not null;

-- RLS Policies
-- Authenticated users can view all designer profiles
do $$
begin
  if not exists (
    select 1 from pg_policies 
    where schemaname = 'public' 
    and tablename = 'fashion_show_designer_profiles' 
    and policyname = 'authenticated_select_fashion_show_designer_profiles'
  ) then
    create policy "authenticated_select_fashion_show_designer_profiles"
      on public.fashion_show_designer_profiles for select
      to authenticated
      using (true);
  end if;
end $$;

-- Anon users can view all designer profiles (public directory)
do $$
begin
  if not exists (
    select 1 from pg_policies 
    where schemaname = 'public' 
    and tablename = 'fashion_show_designer_profiles' 
    and policyname = 'anon_select_fashion_show_designer_profiles'
  ) then
    create policy "anon_select_fashion_show_designer_profiles"
      on public.fashion_show_designer_profiles for select
      to anon
      using (true);
  end if;
end $$;

-- Users can insert their own designer profile
do $$
begin
  if not exists (
    select 1 from pg_policies 
    where schemaname = 'public' 
    and tablename = 'fashion_show_designer_profiles' 
    and policyname = 'authenticated_insert_fashion_show_designer_profiles'
  ) then
    create policy "authenticated_insert_fashion_show_designer_profiles"
      on public.fashion_show_designer_profiles for insert
      to authenticated
      with check (auth.uid() = user_id or user_id is null);
  end if;
end $$;

-- Users can update their own designer profile
do $$
begin
  if not exists (
    select 1 from pg_policies 
    where schemaname = 'public' 
    and tablename = 'fashion_show_designer_profiles' 
    and policyname = 'authenticated_update_fashion_show_designer_profiles'
  ) then
    create policy "authenticated_update_fashion_show_designer_profiles"
      on public.fashion_show_designer_profiles for update
      to authenticated
      using (auth.uid() = user_id or user_id is null)
      with check (auth.uid() = user_id or user_id is null);
  end if;
end $$;

-- Users can delete their own designer profile
do $$
begin
  if not exists (
    select 1 from pg_policies 
    where schemaname = 'public' 
    and tablename = 'fashion_show_designer_profiles' 
    and policyname = 'authenticated_delete_fashion_show_designer_profiles'
  ) then
    create policy "authenticated_delete_fashion_show_designer_profiles"
      on public.fashion_show_designer_profiles for delete
      to authenticated
      using (auth.uid() = user_id or user_id is null);
  end if;
end $$;

-- Trigger to update updated_at
do $$
begin
  if not exists (
    select 1 from pg_trigger 
    where tgname = 'update_fashion_show_designer_profiles_updated_at'
  ) then
    create trigger update_fashion_show_designer_profiles_updated_at
      before update on public.fashion_show_designer_profiles
      for each row
      execute function public.update_updated_at_column();
  end if;
end $$;
;
