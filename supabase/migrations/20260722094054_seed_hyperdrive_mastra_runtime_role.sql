-- IPI-1162 · SB-MIG-003 — create the hyperdrive_mastra_runtime role that
-- 20260722094055_mastra_runtime_grants_and_rls.sql (and later grants) assume
-- already exists.
--
-- That file's own comment documents this exactly: "The role is NOT created
-- by any migration in this repo; it was provisioned directly against the
-- database by IPI-617 · CF-DB-003 — Create Least-Privilege Mastra Hyperdrive
-- Role (predates this chain) and is already live." Same class of gap as the
-- demo-brand fixture data in 20260720072000 — real in production,
-- unreachable from migrations alone.
--
-- NOLOGIN + no password here: this fixture only needs to exist so GRANT/
-- CREATE POLICY statements downstream succeed on a fresh replay. It is not a
-- credential and does not need to match production's real connection
-- role — that is provisioned and rotated outside migrations by design
-- (per IPI-617), same as before this file existed.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'hyperdrive_mastra_runtime') then
    create role hyperdrive_mastra_runtime nologin noinherit;
  end if;
end $$;
