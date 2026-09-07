-- ============================================================================
-- Migration: Create Profiles Table
-- Purpose: Central identity table linking Supabase auth.users to platform roles
-- Affected: public.profiles table
-- Dependencies: auth.users (Supabase Auth), user_role enum
-- ============================================================================

-- Profiles table: Central identity linking auth.users to platform roles
create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text not null,
  full_name text,
  role user_role default 'designer' not null,
  avatar_url text,
  phone text,
  company_name text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  
  -- Constraints
  constraint profiles_email_check check (char_length(email) > 0)
);

comment on table public.profiles is 'Central user profile table linking Supabase auth to platform roles and metadata';

-- Enable RLS (idempotent)
alter table public.profiles enable row level security;
;
