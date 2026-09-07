-- IPI-665 · SB-CI-001 — restate search_brands execute ACLs.
--
-- PostgreSQL discards typmods in function identities (vector(768) ≡ vector),
-- so IPI-665's CREATE OR REPLACE on search_brands replaced the same function
-- and preserved ownership. Default/role grants can still leave anon +
-- authenticated with EXECUTE; lock the surface to service_role explicitly.

revoke execute
on function public.search_brands(vector, integer, uuid)
from public, anon, authenticated;

grant execute
on function public.search_brands(vector, integer, uuid)
to service_role;
