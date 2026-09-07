-- ============================================================================
-- Migration: Seed Event Rehearsals Table (Sample Data)
-- Purpose: Insert sample rehearsal session data for fashion shows
-- Affected: public.event_rehearsals table
-- Dependencies: public.events (event_id), public.stakeholders (rehearsal_lead_id)
-- ============================================================================

-- Sample event rehearsals for testing
-- Note: These require events to exist
-- Replace event_id and rehearsal_lead_id with actual IDs from your database
-- rehearsal_lead_id is optional

-- Example seed data (commented out - requires events)
-- Uncomment and adjust event_id based on your events table

/*
-- Sample Full Run Rehearsal
insert into public.event_rehearsals (
  event_id,
  rehearsal_type,
  date,
  start_time,
  end_time,
  required_models,
  required_designers,
  required_crew,
  rehearsal_lead_id,
  notes
)
values (
  (select id from public.events limit 1), -- Replace with actual event_id
  'full_run',
  '2025-03-15',
  '10:00:00',
  '14:00:00',
  12, -- Required models
  3,  -- Required designers
  8,  -- Required crew
  (select id from public.stakeholders where role = 'producer' limit 1), -- Optional: rehearsal lead
  'Full dress rehearsal with complete runway sequence. All models, designers, and crew required. Final timing check before show day.'
)
on conflict do nothing;

-- Sample Walk Practice Rehearsal
insert into public.event_rehearsals (
  event_id,
  rehearsal_type,
  date,
  start_time,
  end_time,
  required_models,
  required_designers,
  required_crew,
  rehearsal_lead_id,
  notes
)
values (
  (select id from public.events limit 1), -- Replace with actual event_id
  'walk_practice',
  '2025-03-14',
  '14:00:00',
  '16:00:00',
  12, -- Required models
  2,  -- Required designers
  2,  -- Required crew (minimal)
  null, -- No specific lead
  'Model walk practice session. Focus on pacing, turns, and runway positioning. Designers to provide feedback.'
)
on conflict do nothing;

-- Sample Tech Run Rehearsal
insert into public.event_rehearsals (
  event_id,
  rehearsal_type,
  date,
  start_time,
  end_time,
  required_models,
  required_designers,
  required_crew,
  rehearsal_lead_id,
  notes
)
values (
  (select id from public.events limit 1), -- Replace with actual event_id
  'tech_run',
  '2025-03-13',
  '18:00:00',
  '21:00:00',
  6,  -- Partial models for tech check
  2,  -- Required designers
  10, -- Full crew (lighting, sound, stage)
  (select id from public.stakeholders where role = 'lighting_director' limit 1), -- Tech lead
  'Technical rehearsal focusing on lighting, sound, and stage setup. Models needed for lighting tests only.'
)
on conflict do nothing;

-- Sample Lighting Test Rehearsal
insert into public.event_rehearsals (
  event_id,
  rehearsal_type,
  date,
  start_time,
  end_time,
  required_models,
  required_designers,
  required_crew,
  rehearsal_lead_id,
  notes
)
values (
  (select id from public.events limit 1 offset 1), -- Replace with actual event_id
  'lighting_test',
  '2025-03-12',
  '19:00:00',
  '21:00:00',
  3,  -- Minimal models for lighting test
  1,  -- One designer for approval
  5,  -- Lighting crew only
  (select id from public.stakeholders where role = 'lighting_director' limit 1),
  'Lighting test session. Testing different lighting setups and color temperatures. Designer approval required.'
)
on conflict do nothing;
*/

-- Note: Event rehearsals are typically created when planning fashion show production schedules.
-- This seed file is provided as a template for development/testing scenarios.
;
