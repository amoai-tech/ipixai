-- IPI-684 · SB-SEC-001B — follow-up: global default EXECUTE revoke
--
-- 20260719020000 applied schema-only revoke first; that is insufficient on
-- Postgres 17 / Supabase (new functions still receive PUBLIC EXECUTE).
-- Idempotent global + schema hardening.

alter default privileges for role postgres
  revoke execute on functions from public, anon, authenticated;

alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;

alter default privileges for role postgres in schema public
  grant execute on functions to service_role;
