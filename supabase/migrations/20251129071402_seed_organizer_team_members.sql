-- ============================================================================
-- Migration: Seed Organizer Team Members Table (Sample Data)
-- Purpose: Insert sample team membership data for organizer teams
-- Affected: public.organizer_team_members table
-- Dependencies: public.organizer_teams (team_id), auth.users (user_id), public.stakeholders (stakeholder_id)
-- Note: Must have either user_id OR stakeholder_id (not both, not neither)
-- ============================================================================

-- Sample organizer team members for testing
-- Note: These require organizer_teams to exist
-- Replace team_id, user_id, and stakeholder_id with actual IDs from your database
-- Must have either user_id OR stakeholder_id (constraint enforced)

-- Example seed data (commented out - requires organizer_teams, auth.users, or stakeholders)
-- Uncomment and adjust IDs based on your database

/*
-- Sample Team Member (User-based)
insert into public.organizer_team_members (
  team_id,
  user_id,
  stakeholder_id,
  role_in_team
)
values (
  (select id from public.organizer_teams limit 1), -- Replace with actual team_id
  (select id from auth.users limit 1), -- Replace with actual user_id
  null, -- Must be null if user_id is set
  'producer'
)
on conflict do nothing;

-- Sample Team Member (Stakeholder-based)
insert into public.organizer_team_members (
  team_id,
  user_id,
  stakeholder_id,
  role_in_team
)
values (
  (select id from public.organizer_teams limit 1), -- Replace with actual team_id
  null, -- Must be null if stakeholder_id is set
  (select id from public.stakeholders limit 1), -- Replace with actual stakeholder_id
  'assistant'
)
on conflict do nothing;

-- Sample Team Member (Coordinator)
insert into public.organizer_team_members (
  team_id,
  user_id,
  stakeholder_id,
  role_in_team
)
values (
  (select id from public.organizer_teams limit 1), -- Replace with actual team_id
  (select id from auth.users limit 1 offset 1), -- Replace with actual user_id (if available)
  null,
  'coordinator'
)
on conflict do nothing;
*/

-- Note: Team members are typically added when users/stakeholders join organizer teams.
-- This seed file is provided as a template for development/testing scenarios.
-- Remember: Must have either user_id OR stakeholder_id, not both, not neither.
;
