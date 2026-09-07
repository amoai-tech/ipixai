-- IPI-V2-000 · SB-FIX-001 — Revoke remaining anon EXECUTE on brand assets RPC.
-- Live function: public.get_brand_assets(uuid, uuid) SECURITY DEFINER.
-- Body already rejects null auth.uid() and checks brand/org membership.
-- App calls this with the authenticated user client only.
--
-- Why this is not a no-op vs 20260703* / 20260810* :
--   Those files REVOKE ALL FROM PUBLIC then GRANT authenticated.
--   REVOKE FROM PUBLIC does not drop a separate GRANT TO anon (Postgres default
--   privileges on CREATE FUNCTION). Live 2026-08-24 before this file:
--   anon EXECUTE = true. After: false. Security Advisor
--   anon_security_definer_function_executable 1 → 0 on this function.
--
-- Rollback widens access. Do not run in production.
-- Restoring the 2026-08-24 pre-this-file hole:
--   grant execute on function public.get_brand_assets(uuid, uuid) to anon;
-- Do not GRANT TO PUBLIC — that is broader than the live pre-state (explicit
-- anon grant, not PUBLIC). To stay locked, leave this REVOKE in place.

revoke execute
on function public.get_brand_assets(uuid, uuid)
from public, anon;

grant execute
on function public.get_brand_assets(uuid, uuid)
to authenticated;
