-- ============================================================================
-- Migration: Fix Task Assignees to Use stakeholder_id
-- Purpose: Update task_assignees to match fashion show planner schema
-- Affected: public.task_assignees table
-- Dependencies: public.tasks, public.stakeholders
-- Note: Current table uses assignee_id (user), but fashion show planner needs stakeholder_id
-- ============================================================================

-- Add stakeholder_id column
alter table public.task_assignees
  add column if not exists stakeholder_id uuid references public.stakeholders(id) on delete cascade;

-- Migrate existing data: If assignee_id exists and matches a stakeholder profile_id, link it
-- Note: This assumes stakeholders.profile_id matches the assignee_id
update public.task_assignees
set stakeholder_id = (
  select id from public.stakeholders
  where stakeholders.profile_id = task_assignees.assignee_id
  limit 1
)
where stakeholder_id is null and assignee_id is not null;

-- Add unique constraint for stakeholder_id
create unique index if not exists idx_task_assignees_stakeholder_unique 
  on public.task_assignees(task_id, stakeholder_id) 
  where stakeholder_id is not null;

-- Index for stakeholder_id
create index if not exists idx_task_assignees_stakeholder_id 
  on public.task_assignees(stakeholder_id) 
  where stakeholder_id is not null;

-- Comment
comment on column public.task_assignees.stakeholder_id is 'Stakeholder assigned to this task (fashion show planner compatibility). Can coexist with assignee_id for backward compatibility.';

-- Note: We keep assignee_id for backward compatibility with existing shoot booking system
-- Both can coexist - assignee_id for users, stakeholder_id for fashion show planner
;
