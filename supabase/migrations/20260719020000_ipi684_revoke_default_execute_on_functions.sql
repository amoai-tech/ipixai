-- IPI-684 · SB-SEC-001B — Revoke default EXECUTE on new functions (schema-scoped)
--
-- Schema-only revoke applied first; follow-up 20260719021000 adds the required
-- global revoke (Postgres hardwired PUBLIC EXECUTE).

alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;
