-- IPI-680 · SB-SEC-002 — Approach A (disable unused GraphQL)
--
-- Usage check (2026-07-18): operator app / Vite / edge use PostgREST only —
-- no clients call /graphql/v1 or pg_graphql.
--
-- Prior revoke migration cannot clear supabase_admin-owned EXECUTE grants
-- ("WARNING: no privileges could be revoked" as role postgres).
-- Official disable path: drop the extension (Supabase hardening / pg_graphql docs).
-- Closes anon + authenticated GraphQL HTTP; REST SELECT grants unchanged.
--
-- Idempotent if already dropped on the linked remote.

drop extension if exists pg_graphql cascade;
