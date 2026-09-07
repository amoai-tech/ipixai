-- IPI-776 — record migration already applied live on nvdlhrodvevgwdsneplk (idempotent no-op).
-- `postgres` already has MEMBER + ADMIN on hyperdrive_mastra_runtime (IPI-629), but
-- not the SET option — so `SET ROLE hyperdrive_mastra_runtime` fails from a session
-- even though `postgres` can otherwise administer the role. This grants exactly the
-- missing option; it does not change what hyperdrive_mastra_runtime itself can do,
-- only who may assume it inside a session.
grant hyperdrive_mastra_runtime to postgres with set true;
