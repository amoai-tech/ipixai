-- IPI-776 — record migration already applied live on nvdlhrodvevgwdsneplk (idempotent no-op).
-- hyperdrive_mastra_runtime has EXECUTE on pgTAP's functions (PUBLIC by default) but
-- not USAGE on the extensions schema itself, so a session running as that role
-- cannot resolve schema-qualified calls into it ("function does not exist", not
-- "permission denied" — Postgres hides schema contents you cannot see into).
-- Visibility grant only; adds no table access beyond IPI-629's mastra grants.
grant usage on schema extensions to hyperdrive_mastra_runtime;
