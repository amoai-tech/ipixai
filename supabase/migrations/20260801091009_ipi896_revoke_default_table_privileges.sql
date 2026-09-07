-- IPI-896 · SB-SEC-008 — stop pg_default_acl auto-granting every new public
-- table and sequence to anon/authenticated.
--
-- Live before this migration (verified 2026-08-01):
--   pg_default_acl  postgres / public / tables    =
--     {postgres=arwdDxtm, anon=arwdDxtm, authenticated=arwdDxtm, service_role=arwdDxtm}
--   pg_default_acl  postgres / public / sequences =
--     {postgres=rwU, anon=rwU, authenticated=rwU, service_role=rwU}
--
-- so every `create table public.x` handed anon and authenticated the full
-- privilege set, and every new sequence handed them SELECT/UPDATE/USAGE.
--
-- Nothing was exposed by that: all 116 public tables have RLS enabled, and the
-- "RLS on, zero policies, still granted" class is empty. The grant is the
-- loaded half; a missing policy is the safety catch. This removes the loaded
-- half for everything created from here on.
--
-- Why it matters: this default is the engine behind three separate per-table
-- re-revoke tickets — IPI-872 (chatbot_*), IPI-875/876 (public.mastra_*),
-- IPI-888 (processed_firecrawl_webhooks). Each removed the symptom from one
-- table; none touched the default that puts it back on the next one.
--
-- FUTURE-ONLY, by design. ALTER DEFAULT PRIVILEGES never touches existing
-- objects, so all 116 tables keep exactly the grants they have today and no
-- application behaviour changes on deploy.
--
-- ⚠️ What changes for authors: a new table is now unreachable by the app until
-- it is granted explicitly. Add the grant in the same migration that creates
-- the table:
--     create table public.thing (...);
--     alter table public.thing enable row level security;
--     create policy ... on public.thing for select using (...);
--     grant select, insert, update on table public.thing to authenticated;  -- now required
-- Omit it and the symptom is an empty result that reads like an RLS bug.
-- supabase/tests/security/default-table-privileges.sql is the standing guard.
--
-- ⚠️ Second trap, specific to the sequence half of this migration: a `serial`
-- column needs USAGE on its own sequence, and a table-level grant does not
-- cover it. Measured on QA after applying this migration:
--     create table t (id serial primary key, name text);
--     grant select, insert on t to authenticated;
--     set role authenticated; insert into t (name) values ('x');
--     -- ERROR: permission denied for sequence t_id_seq
-- Two ways out, both verified working:
--   1. `id integer generated always as identity primary key` — immune, the
--      system advances the sequence with owner privileges. Prefer this.
--   2. keep `serial` and add
--        grant usage on sequence public.thing_id_seq to authenticated;
-- No table in this repo hits it today — all 78 use
-- `uuid default gen_random_uuid()` and `public` currently holds zero
-- sequences — so this is a trap for a future author, not a live break.
--
-- `for role postgres` is load-bearing. The short form applies only to the
-- *current* role's future objects; migrations run as postgres, so the role must
-- be named. Same form as the Hardening the Data API guide and IPI-684.
--
-- Deliberately schema-scoped, with NO global (`for role postgres` without
-- `in schema`) counterpart — unlike IPI-684, which needed one for functions
-- because Postgres hardwires PUBLIC EXECUTE. Tables and sequences have no such
-- built-in grant. Proven on the QA project inside a rolled-back transaction
-- before writing this file: after the two statements below and nothing else, a
-- freshly created table came back as
--   {postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres}
-- with has_table_privilege('anon', ..., 'SELECT') = false. That is why this is
-- one migration and not the three IPI-684 needed.
--
-- Not touched, deliberately: `planner` (authenticated=arwd), `shoot`
-- (authenticated=r) and `talent` (authenticated=arwd) carry their own
-- schema-scoped defaults that are already narrower than public's and are
-- intentional. `storage`, `graphql*`, `auth`, `realtime`, `cron` and
-- `extensions` are Supabase-owned.
--
-- Also unfixable from here: the parallel `supabase_admin` rows
-- (objects created by the Dashboard or an extension install). A non-superuser
-- `postgres` cannot set default privileges *for* `supabase_admin`. The test
-- asserts those rows have not widened rather than pretending they are fixed.
--
-- Idempotent: safe to re-run.

-- PUBLIC is listed alongside the two roles even though pg_default_acl carries no
-- PUBLIC entry today. anon and authenticated both inherit from PUBLIC, so a future
-- default granting to PUBLIC would hand them access again and this migration would
-- not stop it — while the test asserts PUBLIC is clean. Revoking all three keeps
-- the migration and its guard describing the same invariant. Measured: after
-- `grant insert on t to public`, has_table_privilege('anon', t, 'INSERT') is true.
alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated, public;

alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated, public;

-- Re-assert the writer role so this file declares the full intended end state
-- rather than only a delta. Matches 20260719021000_ipi684.
alter default privileges for role postgres in schema public
  grant all on tables to service_role;

alter default privileges for role postgres in schema public
  grant all on sequences to service_role;
