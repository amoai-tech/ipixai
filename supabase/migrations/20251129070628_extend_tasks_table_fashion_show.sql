-- ============================================================================
-- Migration: Extend Tasks Table for Fashion Show Planner
-- Purpose: Add missing columns required by fashion show planning system
-- Affected: public.tasks table
-- Dependencies: public.events, auth.users, task_priority enum
-- ============================================================================

-- Add event_id column (tasks can belong to events directly, not just phases)
alter table public.tasks
  add column if not exists event_id uuid references public.events(id) on delete cascade;

-- Add created_by column
alter table public.tasks
  add column if not exists created_by uuid references auth.users(id) on delete set null;

-- Add priority column (task_priority enum)
alter table public.tasks
  add column if not exists priority task_priority default 'medium';

-- Comments
comment on column public.tasks.event_id is 'Event this task belongs to (can be set directly or via phase)';
comment on column public.tasks.created_by is 'User who created this task';
comment on column public.tasks.priority is 'Task priority level (low, medium, high, critical)';

-- Indexes
create index if not exists idx_tasks_event_id 
  on public.tasks(event_id) 
  where event_id is not null;

create index if not exists idx_tasks_created_by 
  on public.tasks(created_by) 
  where created_by is not null;

create index if not exists idx_tasks_priority 
  on public.tasks(priority);
;
