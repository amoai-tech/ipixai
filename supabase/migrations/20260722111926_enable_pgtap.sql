-- IPI-776 — record migration already applied live on nvdlhrodvevgwdsneplk (idempotent no-op).
-- Schema-only change: no tables, no data. Mirrors uuid-ossp/pgcrypto/pg_stat_statements,
-- which already live in `extensions` per config.toml's extra_search_path.
create extension if not exists pgtap with schema extensions;
