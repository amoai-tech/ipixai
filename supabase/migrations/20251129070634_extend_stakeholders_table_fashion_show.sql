-- ============================================================================
-- Migration: Extend Stakeholders Table for Fashion Show Planner
-- Purpose: Add missing columns required by fashion show planning system
-- Affected: public.stakeholders table
-- Dependencies: auth.users, stakeholder_role_enum
-- Note: Current table has different role enum - we'll add fashion_show_role for compatibility
-- ============================================================================

-- Add created_by column
alter table public.stakeholders
  add column if not exists created_by uuid references auth.users(id) on delete set null;

-- Add linked_user_id column (for users with app access)
alter table public.stakeholders
  add column if not exists linked_user_id uuid references auth.users(id) on delete set null;

-- Add notes column
alter table public.stakeholders
  add column if not exists notes text;

-- Add fashion_show_role column (stakeholder_role_enum) for fashion show planner compatibility
-- Note: Keeping existing role enum for backward compatibility
alter table public.stakeholders
  add column if not exists fashion_show_role stakeholder_role_enum;

-- Comments
comment on column public.stakeholders.created_by is 'User who created this stakeholder record';
comment on column public.stakeholders.linked_user_id is 'User account linked to this stakeholder (if they have app access)';
comment on column public.stakeholders.notes is 'Additional notes about the stakeholder';
comment on column public.stakeholders.fashion_show_role is 'Role in fashion show planning system (separate from shoot booking role)';

-- Indexes
create index if not exists idx_stakeholders_created_by 
  on public.stakeholders(created_by) 
  where created_by is not null;

create index if not exists idx_stakeholders_linked_user_id 
  on public.stakeholders(linked_user_id) 
  where linked_user_id is not null;

create index if not exists idx_stakeholders_fashion_show_role 
  on public.stakeholders(fashion_show_role) 
  where fashion_show_role is not null;
;
