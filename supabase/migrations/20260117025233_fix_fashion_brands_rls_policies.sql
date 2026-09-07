-- Phase 1: Critical Security Fix #2
-- Fix overly permissive RLS policies on fashion_brands table

begin;

-- Drop existing overly permissive policies
drop policy if exists "authenticated can delete fashion brands" on public.fashion_brands;
drop policy if exists "authenticated can insert fashion brands" on public.fashion_brands;
drop policy if exists "authenticated can update fashion brands" on public.fashion_brands;
drop policy if exists "authenticated can view fashion brands" on public.fashion_brands;
drop policy if exists "anon can view fashion brands" on public.fashion_brands;

-- SELECT: Authenticated users can view all brands (for event selection)
create policy "authenticated can view fashion brands"
on public.fashion_brands
for select
to authenticated
using (true);

create policy "anon can view published fashion brands"
on public.fashion_brands
for select
to anon
using (
  exists (
    select 1
    from public.event_designers ed
    join public.events e on e.id = ed.event_id
    where ed.brand_id = fashion_brands.id
      and e.status = 'published'::event_status
      and e.is_public = true
  )
);

-- INSERT: Authenticated users can create brands
create policy "authenticated can insert fashion brands"
on public.fashion_brands
for insert
to authenticated
with check (true);

-- UPDATE: Only organizers of events using the brand can update it
create policy "authenticated can update fashion brands"
on public.fashion_brands
for update
to authenticated
using (
  exists (
    select 1
    from public.event_designers ed
    join public.events e on e.id = ed.event_id
    where ed.brand_id = fashion_brands.id
      and e.organizer_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.event_designers ed
    join public.events e on e.id = ed.event_id
    where ed.brand_id = fashion_brands.id
      and e.organizer_id = (select auth.uid())
  )
);

-- DELETE: Only organizers of events using the brand can delete it
create policy "authenticated can delete fashion brands"
on public.fashion_brands
for delete
to authenticated
using (
  exists (
    select 1
    from public.event_designers ed
    join public.events e on e.id = ed.event_id
    where ed.brand_id = fashion_brands.id
      and e.organizer_id = (select auth.uid())
  )
  and not exists (
    select 1
    from public.event_designers ed
    join public.events e on e.id = ed.event_id
    where ed.brand_id = fashion_brands.id
      and e.status in ('published', 'live')
  )
);

commit;;
