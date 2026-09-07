-- Phase 1: Critical Security Fix #3 (CORRECTED)
-- Add RLS policies to organizations table
-- Note: organizations table doesn't have owner_id column

begin;

-- Verify RLS is enabled (should already be enabled)
alter table if exists public.organizations enable row level security;

-- Drop existing policies if any (for idempotency)
drop policy if exists "authenticated can view organizations" on public.organizations;
drop policy if exists "authenticated can insert organizations" on public.organizations;
drop policy if exists "authenticated can update organizations" on public.organizations;
drop policy if exists "authenticated can delete organizations" on public.organizations;

-- SELECT: Users can view organizations
create policy "authenticated can view organizations"
on public.organizations
for select
to authenticated
using (true);

-- INSERT: Authenticated users can create organizations
create policy "authenticated can insert organizations"
on public.organizations
for insert
to authenticated
with check (true);

-- UPDATE: Allow authenticated users to update (no owner_id column exists)
-- TODO: Add ownership logic later when owner_id column is added
create policy "authenticated can update organizations"
on public.organizations
for update
to authenticated
using (true)
with check (true);

-- DELETE: Allow authenticated users to delete (no owner_id column exists)
-- TODO: Add ownership logic later when owner_id column is added
create policy "authenticated can delete organizations"
on public.organizations
for delete
to authenticated
using (true);

commit;;
