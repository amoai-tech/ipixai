-- ============================================================================
-- Migration: Create Event Rehearsals Table
-- Purpose: Track detailed rehearsal sessions for fashion shows
-- Affected: public.event_rehearsals table
-- Dependencies: public.events, public.stakeholders, rehearsal_type enum
-- ============================================================================

-- Event rehearsals: Detailed tech run and practice sessions
create table if not exists public.event_rehearsals (
  id uuid default uuid_generate_v4() primary key,
  event_id uuid references public.events(id) on delete cascade not null,
  
  -- Rehearsal details
  rehearsal_type rehearsal_type default 'walk_practice',
  date date not null,
  start_time time not null,
  end_time time,
  
  -- Required participants
  required_models int,
  required_designers int,
  required_crew int,
  
  -- Rehearsal lead
  rehearsal_lead_id uuid references public.stakeholders(id) on delete set null,
  
  -- Notes
  notes text,
  
  -- Timestamps
  created_at timestamptz default now() not null
);

comment on table public.event_rehearsals is 'Detailed rehearsal sessions for fashion shows. Tracks tech runs, walk practice, and other preparation sessions.';

-- Indexes
create index if not exists idx_event_rehearsals_event_id 
  on public.event_rehearsals(event_id);

create index if not exists idx_event_rehearsals_date 
  on public.event_rehearsals(date);

create index if not exists idx_event_rehearsals_rehearsal_lead_id 
  on public.event_rehearsals(rehearsal_lead_id) 
  where rehearsal_lead_id is not null;

-- Enable RLS
alter table public.event_rehearsals enable row level security;

-- RLS Policies
-- Event organizers can view rehearsals for their events
do $$
begin
  if not exists (
    select 1 from pg_policies 
    where schemaname = 'public' 
    and tablename = 'event_rehearsals' 
    and policyname = 'organizers_select_event_rehearsals'
  ) then
    create policy "organizers_select_event_rehearsals"
      on public.event_rehearsals for select
      to authenticated
      using (
        exists (
          select 1 from public.events
          where events.id = event_rehearsals.event_id
          and events.organizer_id = auth.uid()
        )
      );
  end if;
end $$;

-- Public can view rehearsals for published events
do $$
begin
  if not exists (
    select 1 from pg_policies 
    where schemaname = 'public' 
    and tablename = 'event_rehearsals' 
    and policyname = 'public_select_event_rehearsals'
  ) then
    create policy "public_select_event_rehearsals"
      on public.event_rehearsals for select
      to anon
      using (
        exists (
          select 1 from public.events
          where events.id = event_rehearsals.event_id
          and events.status = 'published'
        )
      );
  end if;
end $$;

-- Event organizers can insert rehearsals
do $$
begin
  if not exists (
    select 1 from pg_policies 
    where schemaname = 'public' 
    and tablename = 'event_rehearsals' 
    and policyname = 'organizers_insert_event_rehearsals'
  ) then
    create policy "organizers_insert_event_rehearsals"
      on public.event_rehearsals for insert
      to authenticated
      with check (
        exists (
          select 1 from public.events
          where events.id = event_rehearsals.event_id
          and events.organizer_id = auth.uid()
        )
      );
  end if;
end $$;

-- Event organizers can update rehearsals
do $$
begin
  if not exists (
    select 1 from pg_policies 
    where schemaname = 'public' 
    and tablename = 'event_rehearsals' 
    and policyname = 'organizers_update_event_rehearsals'
  ) then
    create policy "organizers_update_event_rehearsals"
      on public.event_rehearsals for update
      to authenticated
      using (
        exists (
          select 1 from public.events
          where events.id = event_rehearsals.event_id
          and events.organizer_id = auth.uid()
        )
      )
      with check (
        exists (
          select 1 from public.events
          where events.id = event_rehearsals.event_id
          and events.organizer_id = auth.uid()
        )
      );
  end if;
end $$;

-- Event organizers can delete rehearsals
do $$
begin
  if not exists (
    select 1 from pg_policies 
    where schemaname = 'public' 
    and tablename = 'event_rehearsals' 
    and policyname = 'organizers_delete_event_rehearsals'
  ) then
    create policy "organizers_delete_event_rehearsals"
      on public.event_rehearsals for delete
      to authenticated
      using (
        exists (
          select 1 from public.events
          where events.id = event_rehearsals.event_id
          and events.organizer_id = auth.uid()
        )
      );
  end if;
end $$;
;
