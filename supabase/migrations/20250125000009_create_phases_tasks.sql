-- ============================================
-- Migration: Create Production Phases and Tasks Tables
-- Created: 2025-01-25
-- Purpose: Create event_phases, tasks, and task_assignees tables
-- Dependencies: 20250125000000_extensions_and_enums.sql, 20250125000002_create_events_core.sql
-- ============================================

-- ============================================
-- EVENT PHASES TABLE (14-Step Timeline)
-- ============================================

-- Event phases tracks the 14-step production timeline
-- Auto-created when event is created (via trigger)
create table event_phases (
  id uuid default gen_random_uuid() primary key,
  event_id uuid references events(id) on delete cascade not null,
  
  -- Phase information
  phase_name text not null, -- e.g. "Concept & Vision", "Casting", "Venue Selection"
  phase_key text not null, -- e.g. "concept", "casting", "venue" (for programmatic access)
  description text,
  
  -- Status tracking
  status phase_status default 'not_started',
  order_index integer not null, -- For timeline ordering (0-13)
  
  -- Timeline dates
  start_date date,
  target_completion_date date,
  actual_completion_date date,
  
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  
  -- One of each phase per event
  unique(event_id, phase_key)
);
comment on table event_phases is 'Production phases for events. Tracks 14-step timeline from concept to ROI. Auto-created when event is created.';
-- Enable row level security
alter table event_phases enable row level security;
-- ============================================
-- TASKS TABLE (Actionable Items)
-- ============================================

-- Tasks are actionable items within phases
-- Tracks individual to-dos with assignees and due dates
create table tasks (
  id uuid default gen_random_uuid() primary key,
  phase_id uuid references event_phases(id) on delete cascade not null,
  
  -- Task information
  title text not null,
  description text,
  status task_status default 'todo',
  
  -- Timeline
  due_date date,
  completed_at timestamptz,
  
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
comment on table tasks is 'Actionable tasks within event phases. Tracks individual to-dos with status, assignees, and due dates.';
-- Enable row level security
alter table tasks enable row level security;
-- ============================================
-- TASK ASSIGNEES TABLE
-- ============================================

-- Task assignees links users to tasks
-- Supports multiple assignees per task
create table task_assignees (
  id uuid default gen_random_uuid() primary key,
  task_id uuid references tasks(id) on delete cascade not null,
  assignee_id uuid references auth.users(id) on delete restrict not null,
  
  created_at timestamptz default now(),
  
  -- One assignment per user per task
  unique(task_id, assignee_id)
);
comment on table task_assignees is 'Task assignments. Links users to tasks, supporting multiple assignees per task.';
-- Enable row level security
alter table task_assignees enable row level security;
-- ============================================
-- RLS POLICIES FOR EVENT PHASES
-- ============================================

-- Organizers can view phases for their events
create policy "organizers can view event phases"
  on event_phases for select
  to authenticated
  using (
    exists (
      select 1 from events
      where events.id = event_phases.event_id
      and events.organizer_id = auth.uid()
    )
  );
-- Organizers can insert phases for their events
create policy "organizers can insert event phases"
  on event_phases for insert
  to authenticated
  with check (
    exists (
      select 1 from events
      where events.id = event_phases.event_id
      and events.organizer_id = auth.uid()
    )
  );
-- Organizers can update phases for their events
create policy "organizers can update event phases"
  on event_phases for update
  to authenticated
  using (
    exists (
      select 1 from events
      where events.id = event_phases.event_id
      and events.organizer_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from events
      where events.id = event_phases.event_id
      and events.organizer_id = auth.uid()
    )
  );
-- Organizers can delete phases for their events
create policy "organizers can delete event phases"
  on event_phases for delete
  to authenticated
  using (
    exists (
      select 1 from events
      where events.id = event_phases.event_id
      and events.organizer_id = auth.uid()
    )
  );
-- ============================================
-- RLS POLICIES FOR TASKS
-- ============================================

-- Users can view tasks assigned to them
create policy "users can view assigned tasks"
  on tasks for select
  to authenticated
  using (
    exists (
      select 1 from task_assignees
      where task_assignees.task_id = tasks.id
      and task_assignees.assignee_id = auth.uid()
    )
    or exists (
      select 1 from event_phases
      inner join events on events.id = event_phases.event_id
      where event_phases.id = tasks.phase_id
      and events.organizer_id = auth.uid()
    )
  );
-- Organizers can insert tasks for their events
create policy "organizers can insert tasks"
  on tasks for insert
  to authenticated
  with check (
    exists (
      select 1 from event_phases
      inner join events on events.id = event_phases.event_id
      where event_phases.id = tasks.phase_id
      and events.organizer_id = auth.uid()
    )
  );
-- Organizers can update tasks for their events
create policy "organizers can update tasks"
  on tasks for update
  to authenticated
  using (
    exists (
      select 1 from event_phases
      inner join events on events.id = event_phases.event_id
      where event_phases.id = tasks.phase_id
      and events.organizer_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from event_phases
      inner join events on events.id = event_phases.event_id
      where event_phases.id = tasks.phase_id
      and events.organizer_id = auth.uid()
    )
  );
-- Organizers can delete tasks for their events
create policy "organizers can delete tasks"
  on tasks for delete
  to authenticated
  using (
    exists (
      select 1 from event_phases
      inner join events on events.id = event_phases.event_id
      where event_phases.id = tasks.phase_id
      and events.organizer_id = auth.uid()
    )
  );
-- ============================================
-- RLS POLICIES FOR TASK ASSIGNEES
-- ============================================

-- Users can view their own task assignments
create policy "users can view own task assignments"
  on task_assignees for select
  to authenticated
  using (auth.uid() = assignee_id);
-- Organizers can view task assignments for their events
create policy "organizers can view task assignments"
  on task_assignees for select
  to authenticated
  using (
    exists (
      select 1 from tasks
      inner join event_phases on event_phases.id = tasks.phase_id
      inner join events on events.id = event_phases.event_id
      where tasks.id = task_assignees.task_id
      and events.organizer_id = auth.uid()
    )
  );
-- Organizers can insert task assignments for their events
create policy "organizers can insert task assignments"
  on task_assignees for insert
  to authenticated
  with check (
    exists (
      select 1 from tasks
      inner join event_phases on event_phases.id = tasks.phase_id
      inner join events on events.id = event_phases.event_id
      where tasks.id = task_assignees.task_id
      and events.organizer_id = auth.uid()
    )
  );
-- Organizers can update task assignments for their events
create policy "organizers can update task assignments"
  on task_assignees for update
  to authenticated
  using (
    exists (
      select 1 from tasks
      inner join event_phases on event_phases.id = tasks.phase_id
      inner join events on events.id = event_phases.event_id
      where tasks.id = task_assignees.task_id
      and events.organizer_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from tasks
      inner join event_phases on event_phases.id = tasks.phase_id
      inner join events on events.id = event_phases.event_id
      where tasks.id = task_assignees.task_id
      and events.organizer_id = auth.uid()
    )
  );
-- Organizers can delete task assignments for their events
create policy "organizers can delete task assignments"
  on task_assignees for delete
  to authenticated
  using (
    exists (
      select 1 from tasks
      inner join event_phases on event_phases.id = tasks.phase_id
      inner join events on events.id = event_phases.event_id
      where tasks.id = task_assignees.task_id
      and events.organizer_id = auth.uid()
    )
  );
-- ============================================
-- INDEXES FOR PHASES AND TASKS
-- ============================================

-- Index for event phase lookups
create index idx_event_phases_event on event_phases(event_id);
-- Index for phase status filtering
create index idx_event_phases_status on event_phases(status);
-- Index for phase ordering (timeline)
create index idx_event_phases_order on event_phases(event_id, order_index);
-- Index for task phase lookups
create index idx_tasks_phase on tasks(phase_id);
-- Index for task status filtering
create index idx_tasks_status on tasks(status);
-- Index for task due date filtering
create index idx_tasks_due_date on tasks(due_date) where due_date is not null;
-- Index for task assignee lookups
create index idx_task_assignees_task on task_assignees(task_id);
-- Index for user task assignments
create index idx_task_assignees_assignee on task_assignees(assignee_id);
