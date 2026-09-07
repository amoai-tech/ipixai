-- IPI-339 · MG-1 — optimistic-lock column on talent.bookings (D1).
-- Column only: no triggers, no RPCs, no increment logic in this migration.
--
-- Verify:
--   infisical run -- npm run supabase:verify-rls
--   npm run supabase:types
--
-- Rollback:
--   alter table talent.bookings drop column if exists version;

-- Version increments are intentionally handled by future booking RPCs.
-- Do not add update triggers in this migration.

alter table talent.bookings
add column if not exists version integer not null default 1;
