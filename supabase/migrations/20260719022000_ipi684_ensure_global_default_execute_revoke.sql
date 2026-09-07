-- IPI-684 · SB-SEC-001B — ensure global default EXECUTE revoke remains applied
-- (idempotent; remote may have been toggled during booking-gate diagnosis)

alter default privileges for role postgres
  revoke execute on functions from public, anon, authenticated;

alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;

alter default privileges for role postgres in schema public
  grant execute on functions to service_role;
