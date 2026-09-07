-- ============================================================================
-- Migration: Create Organizer Team Members Table
-- Purpose: Link users and stakeholders to organizer teams for collaboration
-- Affected: public.organizer_team_members table
-- Dependencies: public.organizer_teams, auth.users, public.stakeholders
-- ============================================================================

-- Organizer team members: Links users/stakeholders to teams
create table if not exists public.organizer_team_members (
  id uuid default uuid_generate_v4() primary key,
  team_id uuid references public.organizer_teams(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade,
  stakeholder_id uuid references public.stakeholders(id) on delete cascade,
  
  -- Role within the team
  role_in_team text, -- e.g., 'producer', 'assistant', 'coordinator'
  
  -- Timestamps
  created_at timestamptz default now() not null
);

comment on table public.organizer_team_members is 'Team membership for organizer teams. Links users or stakeholders to teams with specific roles.';

-- Constraints: Must have either user_id or stakeholder_id
do $$
begin
  if not exists (
    select 1 from pg_constraint 
    where conname = 'organizer_team_members_user_or_stakeholder_check'
  ) then
    alter table public.organizer_team_members
      add constraint organizer_team_members_user_or_stakeholder_check 
      check ((user_id is not null and stakeholder_id is null) or (user_id is null and stakeholder_id is not null));
  end if;
end $$;

-- Unique constraint: Prevent duplicate memberships
create unique index if not exists idx_organizer_team_members_user_unique 
  on public.organizer_team_members(team_id, user_id) 
  where user_id is not null;

create unique index if not exists idx_organizer_team_members_stakeholder_unique 
  on public.organizer_team_members(team_id, stakeholder_id) 
  where stakeholder_id is not null;

-- Indexes
create index if not exists idx_organizer_team_members_team_id 
  on public.organizer_team_members(team_id);

create index if not exists idx_organizer_team_members_user_id 
  on public.organizer_team_members(user_id) 
  where user_id is not null;

create index if not exists idx_organizer_team_members_stakeholder_id 
  on public.organizer_team_members(stakeholder_id) 
  where stakeholder_id is not null;

-- Enable RLS
alter table public.organizer_team_members enable row level security;

-- RLS Policies
-- Team owners can view all members
do $$
begin
  if not exists (
    select 1 from pg_policies 
    where schemaname = 'public' 
    and tablename = 'organizer_team_members' 
    and policyname = 'team_owners_select_organizer_team_members'
  ) then
    create policy "team_owners_select_organizer_team_members"
      on public.organizer_team_members for select
      to authenticated
      using (
        exists (
          select 1 from public.organizer_teams
          where organizer_teams.id = organizer_team_members.team_id
          and organizer_teams.owner_id = auth.uid()
        )
      );
  end if;
end $$;

-- Team members can view their own team memberships
do $$
begin
  if not exists (
    select 1 from pg_policies 
    where schemaname = 'public' 
    and tablename = 'organizer_team_members' 
    and policyname = 'team_members_select_organizer_team_members'
  ) then
    create policy "team_members_select_organizer_team_members"
      on public.organizer_team_members for select
      to authenticated
      using (
        user_id = auth.uid() 
        or exists (
          select 1 from public.organizer_team_members otm
          where otm.team_id = organizer_team_members.team_id
          and otm.user_id = auth.uid()
        )
      );
  end if;
end $$;

-- Team owners can insert members
do $$
begin
  if not exists (
    select 1 from pg_policies 
    where schemaname = 'public' 
    and tablename = 'organizer_team_members' 
    and policyname = 'team_owners_insert_organizer_team_members'
  ) then
    create policy "team_owners_insert_organizer_team_members"
      on public.organizer_team_members for insert
      to authenticated
      with check (
        exists (
          select 1 from public.organizer_teams
          where organizer_teams.id = organizer_team_members.team_id
          and organizer_teams.owner_id = auth.uid()
        )
      );
  end if;
end $$;

-- Team owners can update members
do $$
begin
  if not exists (
    select 1 from pg_policies 
    where schemaname = 'public' 
    and tablename = 'organizer_team_members' 
    and policyname = 'team_owners_update_organizer_team_members'
  ) then
    create policy "team_owners_update_organizer_team_members"
      on public.organizer_team_members for update
      to authenticated
      using (
        exists (
          select 1 from public.organizer_teams
          where organizer_teams.id = organizer_team_members.team_id
          and organizer_teams.owner_id = auth.uid()
        )
      )
      with check (
        exists (
          select 1 from public.organizer_teams
          where organizer_teams.id = organizer_team_members.team_id
          and organizer_teams.owner_id = auth.uid()
        )
      );
  end if;
end $$;

-- Team owners can delete members
do $$
begin
  if not exists (
    select 1 from pg_policies 
    where schemaname = 'public' 
    and tablename = 'organizer_team_members' 
    and policyname = 'team_owners_delete_organizer_team_members'
  ) then
    create policy "team_owners_delete_organizer_team_members"
      on public.organizer_team_members for delete
      to authenticated
      using (
        exists (
          select 1 from public.organizer_teams
          where organizer_teams.id = organizer_team_members.team_id
          and organizer_teams.owner_id = auth.uid()
        )
      );
  end if;
end $$;
;
